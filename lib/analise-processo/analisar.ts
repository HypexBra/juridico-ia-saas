import "server-only";

import type { Part } from "@google/genai";
import { gerarRespostaEstruturada } from "../ia/chamada-estruturada";
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
 * caso de quota esgotada. Delega para o helper compartilhado
 * `lib/ia/chamada-estruturada.ts#gerarRespostaEstruturada` (ADR 0011, seção
 * 3) — a cópia local (`chamarGeminiComSchema`) foi removida, mesma lógica de
 * retry/backoff/fallback-por-quota, sem mudança de comportamento observável.
 */
function chamarGeminiComSchema(promptTexto: string, parteExtra: Part | null): Promise<unknown> {
  const cadeiaModelos = [MODELO_ANALISE_PROCESSO, MODELO_FALLBACK_QUOTA_ANALISE_PROCESSO];

  return gerarRespostaEstruturada({
    promptTexto,
    parteExtra,
    systemPrompt: ANALISE_PROCESSO_SYSTEM_PROMPT,
    responseSchema: ANALISE_PROCESSO_RESPONSE_SCHEMA,
    maxOutputTokens: MAX_OUTPUT_TOKENS_ANALISE_PROCESSO,
    thinkingBudget: THINKING_BUDGET_ANALISE_PROCESSO,
    cadeiaModelos,
    logPrefixo: "[analise-processo/analisar]",
  });
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
