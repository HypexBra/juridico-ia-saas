import "server-only";

import { Type, type Schema } from "@google/genai";
import { gerarRespostaEstruturada } from "@/lib/ia/chamada-estruturada";

/**
 * EXTRAÇÃO SENTENÇA → CÁLCULO (Fase 16 avançada — dor nº4 da pesquisa de
 * mercado: "cole o trecho e a IA preenche o cálculo"). A IA lê um trecho de
 * sentença/acordo/contrato e devolve SOMENTE os parâmetros do cálculo, cada
 * um acompanhado do TRECHO ORIGINAL que o sustenta (source grounding) —
 * nada é inferido sem lastro no texto.
 */

export const SENTENCA_CALCULO_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    valorOriginal: { type: Type.NUMBER },
    valorOriginalTrecho: { type: Type.STRING },
    dataInicial: { type: Type.STRING },
    dataInicialTrecho: { type: Type.STRING },
    dataFinal: { type: Type.STRING },
    dataFinalTrecho: { type: Type.STRING },
    indiceSugerido: { type: Type.STRING },
    indiceTrecho: { type: Type.STRING },
    jurosPercentualMensal: { type: Type.NUMBER },
    jurosTrecho: { type: Type.STRING },
    tipoJuros: { type: Type.STRING },
    observacoes: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: [
    "valorOriginal",
    "valorOriginalTrecho",
    "dataInicial",
    "dataInicialTrecho",
    "indiceSugerido",
    "indiceTrecho",
    "jurosPercentualMensal",
    "jurosTrecho",
    "tipoJuros",
    "observacoes",
  ],
  propertyOrdering: [
    "valorOriginal",
    "valorOriginalTrecho",
    "dataInicial",
    "dataInicialTrecho",
    "dataFinal",
    "dataFinalTrecho",
    "indiceSugerido",
    "indiceTrecho",
    "jurosPercentualMensal",
    "jurosTrecho",
    "tipoJuros",
    "observacoes",
  ],
};

export type DadosExtraidosSentenca = {
  /** R$ extraído do texto (número puro). */
  valorOriginal: number;
  /** Trecho literal que fundamenta o valor — exibido ao advogado. */
  valorOriginalTrecho: string;
  /** YYYY-MM-DD ou "" quando ausente no texto. */
  dataInicial: string;
  dataInicialTrecho: string;
  dataFinal: string;
  dataFinalTrecho: string;
  /** "ipca" | "selic" | "inpc" | "outro:<nome>" */
  indiceSugerido: string;
  indiceTrecho: string;
  /** % a.m.; 0 quando não houver juros no texto. */
  jurosPercentualMensal: number;
  jurosTrecho: string;
  /** "simples" | "compostos". */
  tipoJuros: string;
  observacoes: string[];
};

export function parsearDadosExtraidos(jsonBruto: unknown): DadosExtraidosSentenca | null {
  if (typeof jsonBruto !== "string") return null;
  try {
    const obj = JSON.parse(jsonBruto) as Record<string, unknown>;
    if (typeof obj.valorOriginal !== "number" || !(obj.valorOriginal > 0)) return null;
    if (typeof obj.indiceSugerido !== "string") return null;
    const normalizarData = (bruta: unknown): string => {
      if (typeof bruta !== "string") return "";
      const iso = bruta.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (iso) return iso[0];
      const br = bruta.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (br) return `${br[3]}-${br[2]}-${br[1]}`;
      return "";
    };
    return {
      valorOriginal: obj.valorOriginal,
      valorOriginalTrecho: typeof obj.valorOriginalTrecho === "string" ? obj.valorOriginalTrecho : "",
      dataInicial: normalizarData(obj.dataInicial),
      dataInicialTrecho: typeof obj.dataInicialTrecho === "string" ? obj.dataInicialTrecho : "",
      dataFinal: normalizarData(obj.dataFinal),
      dataFinalTrecho: typeof obj.dataFinalTrecho === "string" ? obj.dataFinalTrecho : "",
      indiceSugerido: obj.indiceSugerido.toLowerCase(),
      indiceTrecho: typeof obj.indiceTrecho === "string" ? obj.indiceTrecho : "",
      jurosPercentualMensal: typeof obj.jurosPercentualMensal === "number" ? obj.jurosPercentualMensal : 0,
      jurosTrecho: typeof obj.jurosTrecho === "string" ? obj.jurosTrecho : "",
      tipoJuros: obj.tipoJuros === "compostos" ? "compostos" : "simples",
      observacoes: Array.isArray(obj.observacoes) ? obj.observacoes.filter((o): o is string => typeof o === "string") : [],
    };
  } catch {
    return null;
  }
}

const MAX_TRECHO = 40_000;

/**
 * Extrai os parâmetros de cálculo de um trecho jurídico. Cada campo vem com
 * o trecho original — a UI mostra os dois lado a lado para conferência.
 * Falha da IA é propagada como erro para a action traduzir em mensagem.
 */
export async function extrairDadosDeSentenca(texto: string): Promise<DadosExtraidosSentenca> {
  const jsonBruto = await gerarRespostaEstruturada({
    promptTexto: `TRECHO JURÍDICO PARA EXTRAÇÃO:\n\n${texto.slice(0, MAX_TRECHO)}`,
    parteExtra: null,
    systemPrompt:
      'Você extrai parâmetros de cálculo de atualização de dívida de textos jurídicos brasileiros (sentenças, acordos, contratos). Regras ABSOLUTAS: (1) só reporte valores/datas/taxas que estejam ESCRITOS no texto — cada campo deve vir acompanhado do TRECHO LITERAL que o sustenta; (2) se um dado não estiver no texto, use valor vazio/zero para ele e explique nas observações; (3) NUNCA invente ou estime número; (4) datas em formato ISO AAAA-MM-DD; (5) juros em % ao mês (converta % a.a. dividindo por 12 quando composto, ou informe nas observações); (6) indiceSugerido deve ser "ipca", "selic", "inpc" ou "outro:<nome>" conforme o texto determinar.',
    responseSchema: SENTENCA_CALCULO_RESPONSE_SCHEMA,
    maxOutputTokens: 4096,
    thinkingBudget: 512,
    cadeiaModelos: ["gemini-flash-latest", "gemini-flash-lite-latest"],
    logPrefixo: "[calculadoras/extrair-sentenca]",
  });

  const parseado = parsearDadosExtraidos(jsonBruto);
  if (!parseado) throw new Error("Resposta da IA fora do formato esperado.");
  return parseado;
}
