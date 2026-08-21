import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { dividirEmChunks } from "./chunking";
import { gerarEmbedding } from "./embeddings";

type FonteTipo = "documento_upload" | "ficha_caso" | "prazo" | "modelo" | "memoria_ia_caso";

/**
 * Indexa (chunk + embed + insert) um texto de origem qualquer no pgvector.
 * Sempre limpa chunks anteriores da mesma fonte primeiro (idempotente —
 * reprocessar um documento ou reindexar um registro interno não duplica).
 */
export async function indexarTexto(
  supabase: SupabaseClient,
  params: {
    escritorioId: string;
    fonteTipo: FonteTipo;
    fonteId: string;
    texto: string;
    metadata?: Record<string, unknown>;
  },
): Promise<{ totalChunks: number }> {
  const { escritorioId, fonteTipo, fonteId, texto, metadata = {} } = params;

  await supabase.rpc("limpar_chunks_da_fonte", { p_fonte_tipo: fonteTipo, p_fonte_id: fonteId });

  const chunks = dividirEmChunks(texto);
  if (chunks.length === 0) return { totalChunks: 0 };

  const linhas = [];
  for (let i = 0; i < chunks.length; i++) {
    const embedding = await gerarEmbedding(chunks[i], "RETRIEVAL_DOCUMENT");
    linhas.push({
      escritorio_id: escritorioId,
      fonte_tipo: fonteTipo,
      fonte_id: fonteId,
      chunk_index: i,
      conteudo: chunks[i],
      metadata,
      embedding,
    });
  }

  const { error } = await supabase.from("embeddings_chunks").insert(linhas);
  if (error) throw new Error(`Falha ao indexar chunks: ${error.message}`);

  return { totalChunks: chunks.length };
}

export async function removerIndexacao(supabase: SupabaseClient, fonteTipo: FonteTipo, fonteId: string) {
  await supabase.rpc("limpar_chunks_da_fonte", { p_fonte_tipo: fonteTipo, p_fonte_id: fonteId });
}

/**
 * Indexa um chunk de JURISPRUDÊNCIA (fonte_tipo='jurisprudencia'): diferente
 * de `indexarTexto`, aqui `escritorio_id` é sempre NULL — é dado
 * compartilhado entre todos os tenants (migration 0008), então NUNCA deve
 * ser chamado com o client de sessão de um usuário comum (as policies de
 * `embeddings_chunks`/`jurisprudencias` não dão insert para `authenticated`
 * de propósito). Use sempre com `createAdminClient()` (service_role), no
 * mesmo padrão do cron de sincronização do DJEN.
 */
export async function indexarJurisprudenciaChunk(
  supabase: SupabaseClient,
  params: {
    jurisprudenciaId: string;
    texto: string;
    metadata: Record<string, unknown>;
  },
): Promise<{ totalChunks: number }> {
  const { jurisprudenciaId, texto, metadata } = params;

  await supabase.rpc("limpar_chunks_da_fonte", { p_fonte_tipo: "jurisprudencia", p_fonte_id: jurisprudenciaId });

  const chunks = dividirEmChunks(texto);
  if (chunks.length === 0) return { totalChunks: 0 };

  const linhas = [];
  for (let i = 0; i < chunks.length; i++) {
    const embedding = await gerarEmbedding(chunks[i], "RETRIEVAL_DOCUMENT");
    linhas.push({
      escritorio_id: null,
      fonte_tipo: "jurisprudencia" as const,
      fonte_id: jurisprudenciaId,
      chunk_index: i,
      conteudo: chunks[i],
      metadata,
      embedding,
    });
  }

  const { error } = await supabase.from("embeddings_chunks").insert(linhas);
  if (error) throw new Error(`Falha ao indexar chunks de jurisprudência: ${error.message}`);

  return { totalChunks: chunks.length };
}
