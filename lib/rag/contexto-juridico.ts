import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buscarContextoRelevante,
  montarBlocoContexto,
  montarFontesCitaveis,
  type ChunkRecuperado,
  type FonteCitavel,
} from "./retrieval";

/**
 * Ponte entre o RAG e as features de IA que NÃO são o chat (Advogado do
 * Contra, Estrategista, geração de peça, auditoria).
 *
 * Até aqui, `buscarContextoRelevante` era chamado só por `app/api/chat/*` e
 * `app/app/chat/actions.ts`: todas as outras features de IA montavam o prompt
 * apenas com o que o usuário mandou, ou seja, respondiam com o conhecimento
 * "congelado" do modelo. É esse o gap que o item P0.4 aponta como risco
 * jurídico · uma tese atacada sem consultar a jurisprudência recente parece
 * fundamentada e não é.
 *
 * Este módulo não reimplementa nada: reusa o mesmo retrieval, o mesmo bloco
 * delimitado como NÃO CONFIÁVEL (mitigação de prompt injection de
 * `montarBlocoContexto`) e a mesma derivação de fontes citáveis. O que ele
 * adiciona é (1) restringir a busca ao tipo de fonte que faz sentido para
 * cada feature e (2) uma instrução explícita de CITAR fonte e data, exigida
 * pelo critério de aceite do P0.4.
 */

export type ContextoJuridicoRecuperado = {
  /** Bloco pronto para concatenar ao prompt, ou `null` quando nada relevante foi encontrado. */
  bloco: string | null;
  /** Fontes citáveis (deduplicadas) para a UI linkar, no mesmo formato usado pelo chat. */
  fontes: FonteCitavel[];
  chunks: ChunkRecuperado[];
};

const VAZIO: ContextoJuridicoRecuperado = { bloco: null, fontes: [], chunks: [] };

/**
 * Instrução de citação anexada JUNTO ao bloco de contexto, nunca no system
 * prompt: ela só existe quando há contexto de verdade. Se o bloco não vier
 * (nada relevante na base), o modelo não recebe uma ordem de "cite a fonte"
 * pendurada sem fonte nenhuma · que é exatamente o caminho para citação
 * inventada.
 */
const INSTRUCAO_CITACAO = [
  "Ao usar qualquer trecho do contexto acima para embasar um ponto, cite entre parênteses o tribunal/fonte",
  "e a data que constam no próprio trecho (ex: \"STJ, 2026-05-12\"). Nunca invente número de processo,",
  "relator ou data que não esteja escrito no trecho. Se o contexto não sustentar o ponto, diga que é",
  "argumento sem respaldo verificado na base e siga · nunca preencha a lacuna com uma citação plausível.",
].join("\n");

/**
 * Busca jurisprudência relevante para uma tese/peça. Restrito a
 * `fonte_tipo = 'jurisprudencia'` de propósito: contra-argumentar uma tese
 * com a ficha interna do próprio caso seria circular (o texto que está sendo
 * atacado voltaria como "evidência" a favor dele).
 *
 * Nunca lança: RAG é enriquecimento. Se o embedding ou a RPC falharem, a
 * feature segue sem contexto (comportamento anterior à integração) em vez de
 * quebrar a análise inteira · o mesmo `.catch(() => [])` que o chat já usa.
 */
export async function buscarContextoJurisprudencia(
  supabase: SupabaseClient,
  escritorioId: string,
  consulta: string,
): Promise<ContextoJuridicoRecuperado> {
  const consultaLimpa = consulta.trim();
  if (!consultaLimpa) return VAZIO;

  let chunks: ChunkRecuperado[];
  try {
    chunks = await buscarContextoRelevante(supabase, escritorioId, consultaLimpa, {
      fonteTipos: ["jurisprudencia"],
    });
  } catch (erro) {
    console.error(
      "[rag/contexto-juridico] Busca de jurisprudência falhou; seguindo sem contexto:",
      erro instanceof Error ? erro.message : erro,
    );
    return VAZIO;
  }

  const blocoBase = montarBlocoContexto(chunks);
  if (!blocoBase) return VAZIO;

  return {
    bloco: `${blocoBase}\n\n${INSTRUCAO_CITACAO}`,
    fontes: montarFontesCitaveis(chunks),
    chunks,
  };
}

/**
 * Recorta o texto que vira a CONSULTA do RAG. Função pura.
 *
 * Por que truncar: o embedding de query tem um teto de tokens, e uma peça de
 * 60 mil caracteres inteira dilui o vetor até ele não representar mais nada
 * específico (o resultado tende ao "centro" da base e a busca devolve
 * qualquer coisa). O início de uma tese/peça jurídica é onde está a matéria e
 * o pedido · é o pedaço com maior densidade de sinal para similaridade.
 */
export const TAMANHO_MAXIMO_CONSULTA_RAG = 2_000;

export function recortarConsultaRag(texto: string, tamanhoMaximo = TAMANHO_MAXIMO_CONSULTA_RAG): string {
  const limpo = texto.replace(/\s+/g, " ").trim();
  if (limpo.length <= tamanhoMaximo) return limpo;
  // Corta na última fronteira de palavra antes do teto, para não terminar a
  // consulta no meio de um termo técnico ("usucapi").
  const bruto = limpo.slice(0, tamanhoMaximo);
  const ultimoEspaco = bruto.lastIndexOf(" ");
  return ultimoEspaco > tamanhoMaximo * 0.8 ? bruto.slice(0, ultimoEspaco) : bruto;
}
