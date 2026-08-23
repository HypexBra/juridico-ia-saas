import "server-only";

import { gerarRespostaEstruturada } from "../ia/chamada-estruturada";
import { extrairTextoDeDocx, extrairTextoDePdfPorPagina, truncarTextoExtraido } from "../analise-processo/extracao";
import {
  COMPARACAO_DOCUMENTO_RESPONSE_SCHEMA,
  COMPARACAO_DOCUMENTO_SYSTEM_PROMPT,
  montarPromptComparacaoDocumento,
  parsearRespostaComparacaoDocumento,
} from "./prompt-comparacao";
import type { ResultadoComparacaoDocumento } from "./tipos";

/**
 * Comparação aceita apenas "pdf"/"docx" (formatos com extração de texto),
 * não "imagem" — decisão tomada nesta Onda 1, não coberta explicitamente
 * pelo ADR 0011 (o item 7 do plano de implementação descreve
 * `comparar.ts` como "extrai texto dos 2 documentos", diferente do item 6
 * que descreve `analisar.ts` como "despacha por tipoArquivo (pdf/docx/
 * imagem)"). Comparar 2 imagens simultaneamente exigiria 2 partes
 * `inlineData` na mesma chamada multimodal (suportado pela API, mas sem
 * precedente testado nas features existentes) — se o produto precisar disso,
 * é ADR/ajuste futuro, não assumido preventivamente aqui.
 */
export const TIPOS_ARQUIVO_COMPARACAO_DOCUMENTO = ["pdf", "docx"] as const;
export type TipoArquivoComparacaoDocumento = (typeof TIPOS_ARQUIVO_COMPARACAO_DOCUMENTO)[number];

const MODELO_COMPARACAO_DOCUMENTO = "gemini-flash-latest";
const MODELO_FALLBACK_QUOTA_COMPARACAO_DOCUMENTO = "gemini-flash-lite-latest";

/** Budget maior que a análise individual: prompt carrega 2 documentos e o
 * diff pode ter mais itens que uma análise de 1 documento só. */
export const MAX_OUTPUT_TOKENS_COMPARACAO_DOCUMENTO = 16_384;
export const THINKING_BUDGET_COMPARACAO_DOCUMENTO = 2048;

async function extrairTextoPorTipo(buffer: Buffer, tipoArquivo: TipoArquivoComparacaoDocumento) {
  return tipoArquivo === "pdf" ? extrairTextoDePdfPorPagina(new Uint8Array(buffer)) : extrairTextoDeDocx(buffer);
}

export type ParametrosCompararDocumentos = {
  bufferA: Buffer;
  tipoArquivoA: TipoArquivoComparacaoDocumento;
  nomeArquivoA: string;
  bufferB: Buffer;
  tipoArquivoB: TipoArquivoComparacaoDocumento;
  nomeArquivoB: string;
};

export type ResultadoCompararDocumentos =
  | { ok: true; resultado: ResultadoComparacaoDocumento; modeloIaUsado: string }
  | { ok: false; erro: string };

/**
 * Função principal da comparação de 2 documentos (ADR 0011, Onda 1): extrai
 * texto de A e de B, monta o prompt com os 2 marcadores
 * (`===INÍCIO/FIM DOCUMENTO A/B===`), chama o Gemini via
 * `gerarRespostaEstruturada` com `COMPARACAO_DOCUMENTO_RESPONSE_SCHEMA` e
 * parseia a resposta de forma fail-closed. NUNCA lança exceção não tratada —
 * todo erro (extração de qualquer um dos dois lados, chamada de IA, parse)
 * volta como `{ ok: false, erro }` para o caller (Onda 2) decidir como
 * persistir/exibir.
 */
export async function compararDocumentos({
  bufferA,
  tipoArquivoA,
  nomeArquivoA,
  bufferB,
  tipoArquivoB,
  nomeArquivoB,
}: ParametrosCompararDocumentos): Promise<ResultadoCompararDocumentos> {
  try {
    let paginasExtraidasA;
    let paginasExtraidasB;
    try {
      paginasExtraidasA = await extrairTextoPorTipo(bufferA, tipoArquivoA);
    } catch (erroExtracao) {
      return {
        ok: false,
        erro:
          erroExtracao instanceof Error
            ? `Falha ao extrair texto do Documento A: ${erroExtracao.message}`
            : "Falha ao extrair texto do Documento A.",
      };
    }
    try {
      paginasExtraidasB = await extrairTextoPorTipo(bufferB, tipoArquivoB);
    } catch (erroExtracao) {
      return {
        ok: false,
        erro:
          erroExtracao instanceof Error
            ? `Falha ao extrair texto do Documento B: ${erroExtracao.message}`
            : "Falha ao extrair texto do Documento B.",
      };
    }

    const { paginas: paginasA, truncado: truncadoA } = truncarTextoExtraido(paginasExtraidasA);
    const { paginas: paginasB, truncado: truncadoB } = truncarTextoExtraido(paginasExtraidasB);

    const promptTexto = montarPromptComparacaoDocumento({
      nomeArquivoA,
      paginasA,
      truncadoA,
      nomeArquivoB,
      paginasB,
      truncadoB,
    });

    const jsonBruto = await gerarRespostaEstruturada({
      promptTexto,
      parteExtra: null,
      systemPrompt: COMPARACAO_DOCUMENTO_SYSTEM_PROMPT,
      responseSchema: COMPARACAO_DOCUMENTO_RESPONSE_SCHEMA,
      maxOutputTokens: MAX_OUTPUT_TOKENS_COMPARACAO_DOCUMENTO,
      thinkingBudget: THINKING_BUDGET_COMPARACAO_DOCUMENTO,
      cadeiaModelos: [MODELO_COMPARACAO_DOCUMENTO, MODELO_FALLBACK_QUOTA_COMPARACAO_DOCUMENTO],
      logPrefixo: "[document-intelligence/comparar]",
    });

    const resultado = parsearRespostaComparacaoDocumento(jsonBruto);

    if (!resultado) {
      return {
        ok: false,
        erro: "A IA devolveu uma resposta em formato inesperado. Tente novamente ou reenvie os documentos.",
      };
    }

    return { ok: true, resultado, modeloIaUsado: MODELO_COMPARACAO_DOCUMENTO };
  } catch (erro) {
    console.error("[document-intelligence/comparar] Falha ao comparar documentos:", erro);
    return {
      ok: false,
      erro: erro instanceof Error ? erro.message : "Erro desconhecido ao comparar os documentos.",
    };
  }
}
