import "server-only";

import type { Schema } from "@google/genai";
import {
  gerarRespostaGemini,
  gerarRespostaGeminiStream,
  resolverModoRapido,
  type ChatTurno,
  type OpcoesGeracao,
  type RespostaIa,
  type StreamEvento,
} from "./gemini";
import { gerarRespostaGroq, gerarRespostaGroqStream } from "./groq";
import { QuotaExcedidaError, TodosProvidersIndisponiveisError } from "@/lib/ia/erros";

export type { ChatTurno, RespostaIa, StreamEvento, OpcoesGeracao };
export { TodosProvidersIndisponiveisError };

/**
 * Ponto único de fallback entre providers de LLM: Gemini é o provider
 * principal para todos os callers (chat, risco.ts, triagem.ts); quando toda
 * a cadeia de modelos Gemini esgota quota/rate-limit (ver
 * `QuotaExcedidaError` em lib/ia/erros.ts), a MESMA chamada é refeita via
 * Groq — o único outro provider com free tier real sem custo (Gemini e Groq
 * são os dois escolhidos deliberadamente; OpenAI/Claude não têm free tier de
 * API real hoje). Erros que não são de quota (prompt inválido, 5xx real,
 * rede) nunca acionam o fallback — propagam direto para não mascarar bugs
 * reais como indisponibilidade de provider.
 *
 * `providerOverride`, quando presente (switch manual do chat — ver
 * app/app/chat/actions.ts/components/app/chat-app.tsx), chama SÓ o provider
 * escolhido pelo usuário, SEM fallback cross-provider: se ele esgotar,
 * propaga o erro original direto (o usuário escolheu explicitamente, não
 * faz sentido a plataforma decidir trocar por ele).
 */
export async function gerarResposta(
  historico: ChatTurno[],
  opcoes: {
    contextoRag?: string | null;
    habilitarFerramentas?: boolean;
    systemPromptOverride?: string;
    responseSchema?: Schema;
    providerOverride?: { provider: "gemini" | "groq" };
  } = {},
): Promise<RespostaIa> {
  const { providerOverride, ...opcoesGeracao } = opcoes;

  if (providerOverride) {
    return providerOverride.provider === "gemini"
      ? await gerarRespostaGemini(historico, opcoesGeracao)
      : await gerarRespostaGroq(historico, opcoesGeracao);
  }

  let erroGemini: unknown;
  try {
    return await gerarRespostaGemini(historico, opcoesGeracao);
  } catch (erro) {
    if (!(erro instanceof QuotaExcedidaError)) throw erro;
    erroGemini = erro;

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
  }

  try {
    return await gerarRespostaGroq(historico, opcoesGeracao);
  } catch (erroGroq) {
    // Fix do bug "a IA está indisponível, não troca": antes, QUALQUER erro
    // do Groq aqui (incluindo o próprio esgotamento do Groq) propagava
    // sozinho e mascarava que o Gemini TAMBÉM já tinha falhado por quota —
    // o operador via só "erro do Groq" no log e não enxergava que os DOIS
    // providers estavam indisponíveis. Agora ambas as causas originais são
    // preservadas em `TodosProvidersIndisponiveisError`, que
    // app/app/chat/actions.ts trata com um log estruturado distinto
    // (`pool_llm_esgotado`) só quando o esgotamento é de fato de AMBOS os
    // providers.
    throw new TodosProvidersIndisponiveisError(erroGemini, erroGroq);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STREAMING cross-provider — mesma política de fallback do `gerarResposta`:
// Gemini primeiro; se falhar ANTES do primeiro token (quota/5xx na abertura),
// o MESMO turno é refeito via Groq. Depois que tokens começam a fluir não há
// fallback (duplicaria texto já exibido) — erro mid-stream vira evento "erro".

export async function* gerarRespostaStream(
  historico: ChatTurno[],
  opcoes: {
    contextoRag?: string | null;
    habilitarFerramentas?: boolean;
    systemPromptOverride?: string;
    modoRapido?: boolean;
    providerOverride?: { provider: "gemini" | "groq" };
  } = {},
): AsyncGenerator<StreamEvento, void, unknown> {
  const { providerOverride, ...opcoesGeracao } = opcoes;

  if (providerOverride) {
    yield* providerOverride.provider === "gemini"
      ? gerarRespostaGeminiStream(historico, opcoesGeracao)
      : gerarRespostaGroqStream(historico, opcoesGeracao);
    return;
  }

  let erroGemini: unknown;
  try {
    yield* gerarRespostaGeminiStream(historico, opcoesGeracao);
    return;
  } catch (erro) {
    if (!(erro instanceof QuotaExcedidaError)) throw erro;
    erroGemini = erro;
    console.error(
      JSON.stringify({
        evento: "fallback_provider_llm_streaming",
        de: "gemini",
        para: "groq",
        motivo: "quota_excedida",
        timestamp: new Date().toISOString(),
      }),
    );
  }

  try {
    yield* gerarRespostaGroqStream(historico, opcoesGeracao);
  } catch (erroGroq) {
    throw new TodosProvidersIndisponiveisError(erroGemini, erroGroq);
  }
}

/** Reexport para callers decidirem modo rápido sem importar gemini direto. */
export { mensagemTrivial } from "./gate-trivialidade";
export { resolverModoRapido };
