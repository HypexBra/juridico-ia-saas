import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { gerarEmbedding } from "@/lib/rag/embeddings";

/**
 * Busca híbrida de jurisprudência — Fase 7.
 *
 * Duas estratégias complementares (a IA jurídica precisa das duas):
 *   1. LEXICAL: full-text pt-BR sobre `busca_tsvector` (migration 0042) —
 *      resolve termos técnicos exatos e números de processo. É a primária.
 *      Fallback transparente para ILIKE se a migration ainda não rodou
 *      (coluna gerada inexistente) — degrada, nunca quebra.
 *   2. SEMÂNTICA: RAG vetorial existente (buscar_chunks_similares filtrado
 *      a fonte_tipo='jurisprudencia') — resolve "decisões SOBRE esse tema"
 *      quando o advogado não sabe o termo exato.
 *
 * Resultados são mesclados sem duplicar (full-text primeiro) e devolvidos
 * já com os metadados estruturados para exibição/citação verificável.
 */

export type ResultadoJurisprudencia = {
  id: string;
  tribunal: string;
  numero_processo: string;
  classe: string | null;
  relator: string | null;
  orgao_julgador: string | null;
  ementa: string;
  data_julgamento: string | null;
  data_publicacao: string | null;
  tese: string | null;
  tema: number | null;
  origem: string;
  /** Como este resultado foi encontrado — rastreabilidade da busca. */
  via: "lexical" | "semantica";
};

const CAMPOS = "id, tribunal, numero_processo, classe, relator, orgao_julgador, ementa, data_julgamento, data_publicacao, tese, tema, origem";
const LIMITE = 20;

export async function buscarJurisprudencia(
  supabase: SupabaseClient,
  escritorioId: string,
  termo: string,
): Promise<{ resultados: ResultadoJurisprudencia[]; aviso?: string }> {
  const limpo = termo.trim();
  if (!limpo) return { resultados: [] };

  const resultadosPorId = new Map<string, ResultadoJurisprudencia>();
  let aviso: string | undefined;

  // ── 1. Lexical (tsvector websearch pt-BR) ──
  try {
    const { data, error } = await supabase
      .from("jurisprudencias")
      .select(CAMPOS)
      .textSearch("busca_tsvector", limpo, { type: "websearch", config: "portuguese" })
      .limit(LIMITE);
    if (error) throw error;
    for (const row of (data ?? []) as ResultadoJurisprudencia[]) {
      resultadosPorId.set(row.id, { ...row, via: "lexical" });
    }
  } catch {
    // Migration 0042 ainda não aplicada (ou índice indisponível): fallback
    // lexical simples por ILIKE — menos preciso, mas funcional HOJE.
    aviso = "Busca lexical completa indisponível (migration 0042 pendente); usando busca simplificada.";
    const padrao = `%${limpo.replace(/[%_]/g, "")}%`;
    const { data } = await supabase
      .from("jurisprudencias")
      .select(CAMPOS)
      .or(`ementa.ilike.${padrao},numero_processo.ilike.${padrao}`)
      .limit(LIMITE);
    for (const row of (data ?? []) as ResultadoJurisprudencia[]) {
      resultadosPorId.set(row.id, { ...row, via: "lexical" });
    }
  }

  // Número de processo exato não precisa de reforço semântico.
  const ehNumeroExato = /^\d{7}-?\d{2}\.\d{4}\.\d{1}\.\d{2}\.\d{4}$/.test(limpo.replace(/\s/g, ""));
  if (!ehNumeroExato && resultadosPorId.size < LIMITE) {
    try {
      const embeddingConsulta = await gerarEmbedding(limpo, "RETRIEVAL_QUERY");
      const { data: chunks, error: erroRpc } = await supabase.rpc("buscar_chunks_similares", {
        p_escritorio_id: escritorioId,
        p_query_embedding: embeddingConsulta,
        p_match_count: 8,
        p_fonte_tipos: ["jurisprudencia"],
      });

      if (!erroRpc && chunks?.length) {
        const idsFaltantes = (chunks as { fonte_id: string }[])
          .map((c) => c.fonte_id)
          .filter((id) => !resultadosPorId.has(id));
        if (idsFaltantes.length > 0) {
          const { data: registros } = await supabase
            .from("jurisprudencias")
            .select(CAMPOS)
            .in("id", idsFaltantes)
            .limit(LIMITE - resultadosPorId.size);
          for (const row of (registros ?? []) as ResultadoJurisprudencia[]) {
            resultadosPorId.set(row.id, { ...row, via: "semantica" });
          }
        }
      }
    } catch {
      // Semântica é reforço best-effort: falha de embedding/RPC nunca derruba
      // a busca inteira — o resultado lexical já foi entregue acima.
    }
  }

  return { resultados: [...resultadosPorId.values()], aviso };
}

/** Busca registros por IDs diretos (usada pelo comparador). */
export async function buscarJurisprudenciaPorIds(
  supabase: SupabaseClient,
  ids: string[],
): Promise<ResultadoJurisprudencia[]> {
  if (ids.length === 0 || ids.length > 4) return [];
  const { data, error } = await supabase
    .from("jurisprudencias")
    .select(CAMPOS)
    .in("id", ids)
    .limit(4);
  if (error) return [];
  return (data ?? []) as ResultadoJurisprudencia[];
}
