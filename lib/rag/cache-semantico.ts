import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Caching semântico (migration 0051): intercepta perguntas de conhecimento
 * jurídico GERAL repetidas/reformuladas antes de pagar uma nova chamada de
 * LLM. Chamador (app/app/chat/actions.ts, app/api/chat/mensagem/route.ts) é
 * responsável por só usar isto quando `modo === 'interno'` (ver
 * lib/ia/roteador-contexto.ts) — nunca para pergunta dependente de RAG ou de
 * pesquisa web atualizada.
 *
 * Nunca lança: cache é otimização pura, uma falha aqui nunca deve impedir a
 * pergunta de seguir para o LLM normalmente.
 */

const SIMILARIDADE_MINIMA = 0.96;

export type RespostaCacheada = {
  resposta: string;
  tokensIn: number;
  tokensOut: number;
  modelo: string | null;
};

export async function buscarRespostaCacheada(
  supabase: SupabaseClient,
  escritorioId: string,
  embeddingConsulta: number[],
): Promise<RespostaCacheada | null> {
  try {
    const { data, error } = await supabase
      .rpc("buscar_resposta_cache_semantico", {
        p_escritorio_id: escritorioId,
        p_query_embedding: embeddingConsulta,
        p_similaridade_minima: SIMILARIDADE_MINIMA,
      })
      .maybeSingle<{ resposta: string; tokens_in: number; tokens_out: number; modelo: string | null }>();

    if (error || !data) return null;
    return { resposta: data.resposta, tokensIn: data.tokens_in, tokensOut: data.tokens_out, modelo: data.modelo };
  } catch (erro) {
    console.error("[rag/cache-semantico] Falha ao consultar cache; seguindo sem cache:", erro);
    return null;
  }
}

/** Grava best-effort — nunca bloqueia nem lança: perder um cache-write é só uma oportunidade de hit futuro perdida. */
export async function salvarRespostaCacheSemantico(
  supabase: SupabaseClient,
  params: {
    escritorioId: string;
    pergunta: string;
    embeddingConsulta: number[];
    resposta: string;
    tokensIn: number;
    tokensOut: number;
    modelo: string | null;
  },
): Promise<void> {
  try {
    await supabase.from("respostas_cache_semantico").insert({
      escritorio_id: params.escritorioId,
      pergunta: params.pergunta,
      pergunta_embedding: params.embeddingConsulta,
      resposta: params.resposta,
      tokens_in: params.tokensIn,
      tokens_out: params.tokensOut,
      modelo: params.modelo,
    });
  } catch (erro) {
    console.error("[rag/cache-semantico] Falha ao salvar cache; seguindo sem gravar:", erro);
  }
}
