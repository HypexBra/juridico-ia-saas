import "server-only";

import type { Schema } from "@google/genai";
import { gerarRespostaGemini, QuotaExcedidaError, type ChatTurno, type RespostaIa } from "./gemini";
import { gerarRespostaGroq } from "./groq";

export type { ChatTurno, RespostaIa };

/**
 * Ponto único de fallback entre providers de LLM: Gemini é o provider
 * principal para todos os callers (chat, risco.ts, triagem.ts); quando toda
 * a cadeia de modelos Gemini esgota quota/rate-limit (ver
 * `QuotaExcedidaError` em lib/ia/gemini.ts), a MESMA chamada é refeita via
 * Groq — o único outro provider com free tier real sem custo (Gemini e Groq
 * são os dois escolhidos deliberadamente; OpenAI/Claude não têm free tier de
 * API real hoje). Erros que não são de quota (prompt inválido, 5xx real,
 * rede) nunca acionam o fallback — propagam direto para não mascarar bugs
 * reais como indisponibilidade de provider.
 */
export async function gerarResposta(
  historico: ChatTurno[],
  opcoes: {
    contextoRag?: string | null;
    habilitarFerramentas?: boolean;
    systemPromptOverride?: string;
    responseSchema?: Schema;
  } = {},
): Promise<RespostaIa> {
  try {
    return await gerarRespostaGemini(historico, opcoes);
  } catch (erro) {
    if (!(erro instanceof QuotaExcedidaError)) throw erro;

    // Log estruturado (sem qualquer chave/segredo) para dar visibilidade em
    // produção de quando o Gemini está no limite de quota e o Groq assumiu.
    console.error(
      JSON.stringify({
        evento: "fallback_provider_llm",
        de: "gemini",
        para: "groq",
        motivo: "quota_excedida",
        timestamp: new Date().toISOString(),
      }),
    );

    return await gerarRespostaGroq(historico, opcoes);
  }
}
