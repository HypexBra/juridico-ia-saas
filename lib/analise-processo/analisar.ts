import "server-only";

import { GoogleGenAI, type Part } from "@google/genai";
import {
  ANALISE_PROCESSO_RESPONSE_SCHEMA,
  ANALISE_PROCESSO_SYSTEM_PROMPT,
  montarPromptAnaliseProcesso,
  parsearRespostaAnaliseProcesso,
} from "./prompt";
import {
  extrairTextoDeDocx,
  extrairTextoDePdfPorPagina,
  truncarTextoExtraido,
  type PaginaTextoExtraido,
} from "./extracao";
import type { ResultadoAnaliseProcesso } from "./tipos";

export const TIPOS_ARQUIVO_ANALISE_PROCESSO = ["pdf", "docx", "imagem"] as const;
export type TipoArquivoAnaliseProcesso = (typeof TIPOS_ARQUIVO_ANALISE_PROCESSO)[number];

/**
 * Nome de modelo isolado desta feature (não reaproveita as constantes de
 * `lib/ia/gemini.ts` para não acoplar o teto de tokens do chat ao desta
 * análise — ver ADR 0004 seção 6). "gemini-flash-latest" é o mesmo alias
 * usado no chat: aponta sempre para a versão atual recomendada pelo Google
 * (nomes fixos de modelo já causaram indisponibilidade no passado — ver
 * `.agents/memoria/erros-corrigidos.md`, 2026-08-18/19).
 */
const MODELO_ANALISE_PROCESSO = "gemini-flash-latest";
/** Modelo de fallback quando o principal esgota quota (429) — família
 * diferente, pool de quota separado, mesmo padrão de `lib/ia/gemini.ts`. */
const MODELO_FALLBACK_QUOTA_ANALISE_PROCESSO = "gemini-flash-lite-latest";

// Budgets dedicados e maiores que os do chat (ADR 0004 seção 6): 12 seções
// ricas exigem mais que os 8192 de MAX_OUTPUT_TOKENS_PRO do chat.
export const MAX_OUTPUT_TOKENS_ANALISE_PROCESSO = 16_384;
export const THINKING_BUDGET_ANALISE_PROCESSO = 2048;

const MAX_TENTATIVAS = 3;
const BASE_DELAY_MS = 600;
const BASE_DELAY_MS_QUOTA = 15_000;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isErroDeQuota(erro: unknown): boolean {
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  return /429|quota|rate.?limit/i.test(mensagem);
}

function isErroTransiente(erro: unknown): boolean {
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  return /429|500|502|503|504|rate.?limit|timeout|ECONNRESET|ETIMEDOUT|UNAVAILABLE/i.test(mensagem);
}

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada");
  return new GoogleGenAI({ apiKey });
}

const MIME_TYPE_POR_EXTENSAO: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function inferirMimeTypeImagem(nomeArquivo: string): string {
  const extensao = nomeArquivo.toLowerCase().split(".").pop() ?? "";
  return MIME_TYPE_POR_EXTENSAO[extensao] ?? "image/jpeg";
}

/**
 * Chama o Gemini uma única vez (sem histórico de chat — cada análise é
 * independente) com `responseSchema` fixo e cadeia de fallback de modelo em
 * caso de quota esgotada, mesmo padrão de retry/backoff de
 * `lib/ia/gemini.ts#gerarRespostaGemini`. Mantido self-contido neste módulo
 * (em vez de estender `lib/ia/gemini.ts`, hoje focado em chat multi-turno
 * texto-only) para não acoplar o teto de tokens/retry do chat ao desta
 * análise — se um padrão comum de "chamada estruturada one-shot" emergir
 * entre features, extrair um helper compartilhado é candidato a refactor
 * futuro, não decidido preventivamente aqui.
 */
async function chamarGeminiComSchema(promptTexto: string, parteExtra: Part | null): Promise<unknown> {
  const genAI = getClient();
  const parts: Part[] = [{ text: promptTexto }];
  if (parteExtra) parts.push(parteExtra);

  const cadeiaModelos = [MODELO_ANALISE_PROCESSO, MODELO_FALLBACK_QUOTA_ANALISE_PROCESSO].filter(
    (modelo, indice, lista) => lista.indexOf(modelo) === indice,
  );

  let ultimoErro: unknown;
  for (const modelo of cadeiaModelos) {
    let erroDeQuotaEsgotouRetentativas = false;

    for (let tentativa = 0; tentativa < MAX_TENTATIVAS; tentativa++) {
      try {
        const resposta = await genAI.models.generateContent({
          model: modelo,
          contents: [{ role: "user", parts }],
          config: {
            systemInstruction: ANALISE_PROCESSO_SYSTEM_PROMPT,
            maxOutputTokens: MAX_OUTPUT_TOKENS_ANALISE_PROCESSO,
            thinkingConfig: { thinkingBudget: THINKING_BUDGET_ANALISE_PROCESSO },
            responseMimeType: "application/json",
            responseSchema: ANALISE_PROCESSO_RESPONSE_SCHEMA,
          },
        });

        const texto = resposta.text;
        if (!texto) throw new Error("Resposta vazia do Gemini.");
        return JSON.parse(texto);
      } catch (erro) {
        ultimoErro = erro;
        const deQuota = isErroDeQuota(erro);
        if (!isErroTransiente(erro) || tentativa === MAX_TENTATIVAS - 1 || (deQuota && tentativa >= 1)) {
          erroDeQuotaEsgotouRetentativas = deQuota;
          break;
        }
        await delay(deQuota ? BASE_DELAY_MS_QUOTA : BASE_DELAY_MS * 2 ** tentativa);
      }
    }

    if (!erroDeQuotaEsgotouRetentativas) throw ultimoErro;
    console.error(
      `[analise-processo/analisar] Quota esgotada em "${modelo}", tentando próximo modelo da cadeia (se houver).`,
    );
  }

  throw ultimoErro instanceof Error ? ultimoErro : new Error("Falha desconhecida ao chamar o Gemini.");
}

export type ParametrosAnalisarDocumentoProcesso = {
  buffer: Buffer;
  tipoArquivo: TipoArquivoAnaliseProcesso;
  nomeArquivo: string;
};

export type ResultadoAnalisarDocumentoProcesso =
  | { ok: true; resultado: ResultadoAnaliseProcesso; modeloIaUsado: string }
  | { ok: false; erro: string };

/**
 * Função principal da Onda 1 (ADR 0004): decide o caminho de extração por
 * `tipoArquivo`, monta o prompt final (texto extraído por página OU imagem
 * inline), chama o Gemini com `ANALISE_PROCESSO_RESPONSE_SCHEMA` e parseia a
 * resposta de forma fail-closed. NUNCA lança exceção não tratada — todo erro
 * (extração, chamada de IA, parse) volta como `{ ok: false, erro }` para o
 * caller (`app/app/fichas/[id]/analise-processo-actions.ts`, Onda 2) decidir
 * como persistir/exibir.
 */
export async function analisarDocumentoProcesso({
  buffer,
  tipoArquivo,
  nomeArquivo,
}: ParametrosAnalisarDocumentoProcesso): Promise<ResultadoAnalisarDocumentoProcesso> {
  try {
    let promptTexto: string;
    let parteExtra: Part | null = null;

    if (tipoArquivo === "imagem") {
      promptTexto = montarPromptAnaliseProcesso({ tipo: "imagem", nomeArquivo });
      parteExtra = {
        inlineData: { mimeType: inferirMimeTypeImagem(nomeArquivo), data: buffer.toString("base64") },
      };
    } else {
      let paginasExtraidas: PaginaTextoExtraido[];
      try {
        paginasExtraidas =
          tipoArquivo === "pdf"
            ? await extrairTextoDePdfPorPagina(new Uint8Array(buffer))
            : await extrairTextoDeDocx(buffer);
      } catch (erroExtracao) {
        return {
          ok: false,
          erro: erroExtracao instanceof Error ? erroExtracao.message : "Falha ao extrair texto do documento.",
        };
      }

      const { paginas, truncado } = truncarTextoExtraido(paginasExtraidas);
      promptTexto = montarPromptAnaliseProcesso({ tipo: "texto", nomeArquivo, paginas, truncado });
    }

    const jsonBruto = await chamarGeminiComSchema(promptTexto, parteExtra);
    const resultado = parsearRespostaAnaliseProcesso(jsonBruto);

    if (!resultado) {
      return {
        ok: false,
        erro: "A IA devolveu uma resposta em formato inesperado. Tente novamente ou reenvie o documento.",
      };
    }

    return { ok: true, resultado, modeloIaUsado: MODELO_ANALISE_PROCESSO };
  } catch (erro) {
    console.error("[analise-processo/analisar] Falha ao analisar documento de processo:", erro);
    return {
      ok: false,
      erro: erro instanceof Error ? erro.message : "Erro desconhecido ao analisar o documento.",
    };
  }
}
