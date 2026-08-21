import "server-only";

import type { Part } from "@google/genai";
import { gerarRespostaEstruturada } from "../ia/chamada-estruturada";
import { mensagemErroIaParaUsuario } from "../ia/erros";
import {
  extrairTextoDeDocx,
  extrairTextoDePdfPorPagina,
  truncarTextoExtraido,
  type PaginaTextoExtraido,
} from "../analise-processo/extracao";
import {
  DOCUMENT_INTELLIGENCE_RESPONSE_SCHEMA,
  DOCUMENT_INTELLIGENCE_SYSTEM_PROMPT,
  montarPromptAnaliseDocumento,
  parsearRespostaAnaliseDocumento,
} from "./prompt";
import type { ResultadoAnaliseDocumento } from "./tipos";

export const TIPOS_ARQUIVO_ANALISE_DOCUMENTO = ["pdf", "docx", "imagem"] as const;
export type TipoArquivoAnaliseDocumento = (typeof TIPOS_ARQUIVO_ANALISE_DOCUMENTO)[number];

/**
 * Reexportado de `./constantes` (módulo sem `import "server-only"`) para
 * quem já consome este arquivo em contexto server (actions/Server
 * Components) — ver o comentário em `lib/analise-documento/constantes.ts`
 * para o motivo de não estar definida diretamente aqui. Client Components
 * (ex: `components/app/documento-lote-form.tsx`) devem importar direto de
 * `@/lib/analise-documento/constantes`, nunca deste arquivo.
 */
export { MAX_ARQUIVOS_LOTE_DOCUMENTO } from "./constantes";

/**
 * Modelo isolado desta feature — mesmo racional de
 * `lib/analise-processo/analisar.ts` (ver ADR 0004 seção 6 e ADR 0011): não
 * reaproveita as constantes de `lib/ia/gemini.ts` (chat) para não acoplar o
 * teto de tokens/retry do chat a esta análise. "gemini-flash-latest" é o
 * mesmo alias usado nas outras 2 features Gemini deste projeto (nomes fixos
 * de modelo já causaram indisponibilidade no passado — ver
 * `.agents/memoria/erros-corrigidos.md`, 2026-08-18/19).
 */
const MODELO_DOCUMENT_INTELLIGENCE = "gemini-flash-latest";
const MODELO_FALLBACK_QUOTA_DOCUMENT_INTELLIGENCE = "gemini-flash-lite-latest";

/** Budget menor que o de análise de processo (12 seções ricas) — 1 documento
 * avulso com poucas seções cabe em um teto de saída mais enxuto. */
export const MAX_OUTPUT_TOKENS_DOCUMENT_INTELLIGENCE = 8192;
export const THINKING_BUDGET_DOCUMENT_INTELLIGENCE = 1024;

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

export type ParametrosAnalisarDocumento = {
  buffer: Buffer;
  tipoArquivo: TipoArquivoAnaliseDocumento;
  nomeArquivo: string;
};

export type ResultadoAnalisarDocumento =
  | { ok: true; resultado: ResultadoAnaliseDocumento; modeloIaUsado: string }
  | { ok: false; erro: string };

/**
 * Função principal da análise individual de documento avulso (ADR 0011,
 * Onda 1). Espelha `lib/analise-processo/analisar.ts#analisarDocumentoProcesso`:
 * decide o caminho de extração por `tipoArquivo`, monta o prompt final (texto
 * extraído por página OU imagem inline), chama o Gemini via
 * `gerarRespostaEstruturada` com `DOCUMENT_INTELLIGENCE_RESPONSE_SCHEMA` e
 * parseia a resposta de forma fail-closed. NUNCA lança exceção não tratada —
 * todo erro (extração, chamada de IA, parse) volta como `{ ok: false, erro }`
 * para o caller (Onda 2) decidir como persistir/exibir.
 */
export async function analisarDocumento({
  buffer,
  tipoArquivo,
  nomeArquivo,
}: ParametrosAnalisarDocumento): Promise<ResultadoAnalisarDocumento> {
  try {
    let promptTexto: string;
    let parteExtra: Part | null = null;

    if (tipoArquivo === "imagem") {
      promptTexto = montarPromptAnaliseDocumento({ tipo: "imagem", nomeArquivo });
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
      promptTexto = montarPromptAnaliseDocumento({ tipo: "texto", nomeArquivo, paginas, truncado });
    }

    const jsonBruto = await gerarRespostaEstruturada({
      promptTexto,
      parteExtra,
      systemPrompt: DOCUMENT_INTELLIGENCE_SYSTEM_PROMPT,
      responseSchema: DOCUMENT_INTELLIGENCE_RESPONSE_SCHEMA,
      maxOutputTokens: MAX_OUTPUT_TOKENS_DOCUMENT_INTELLIGENCE,
      thinkingBudget: THINKING_BUDGET_DOCUMENT_INTELLIGENCE,
      cadeiaModelos: [MODELO_DOCUMENT_INTELLIGENCE, MODELO_FALLBACK_QUOTA_DOCUMENT_INTELLIGENCE],
      logPrefixo: "[analise-documento/analisar]",
    });

    const resultado = parsearRespostaAnaliseDocumento(jsonBruto);

    if (!resultado) {
      return {
        ok: false,
        erro: "A IA devolveu uma resposta em formato inesperado. Tente novamente ou reenvie o documento.",
      };
    }

    return { ok: true, resultado, modeloIaUsado: MODELO_DOCUMENT_INTELLIGENCE };
  } catch (erro) {
    console.error("[analise-documento/analisar] Falha ao analisar documento:", erro);
    return { ok: false, erro: mensagemErroIaParaUsuario(erro) };
  }
}
