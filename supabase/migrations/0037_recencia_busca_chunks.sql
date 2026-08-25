-- Adiciona leve boost de recência ao ranking de `buscar_chunks_similares`
-- (lib/rag/retrieval.ts). Antes: ranking era só `embedding <=> query`
-- (similaridade pura) — um chunk desatualizado com texto parecido competia
-- em pé de igualdade com um mais recente, podendo vencer por distância
-- marginalmente menor. `criado_em` reflete a última (re)indexação da fonte
-- (ver lib/rag/ingestao.ts#indexarTexto: sempre limpa chunks antigos da
-- mesma fonte antes de inserir os novos, então é um proxy confiável de
-- "quão recente é este conteúdo", não só de quando a linha foi criada).
--
-- Decaimento exponencial pequeno (meia-vida de ~180 dias, boost máx. 0.03 em
-- pontos de distância de cosseno) — só desempata candidatos já relevantes
-- (distância já filtrada a <= 0.7 em retrieval.ts), nunca faz um chunk
-- irrelevante furar o corte de relevância.
create or replace function buscar_chunks_similares(
  p_escritorio_id uuid,
  p_query_embedding vector(768),
  p_match_count int default 6,
  p_fonte_tipos varchar[] default null
)
returns table (
  id uuid,
  fonte_tipo varchar,
  fonte_id uuid,
  conteudo text,
  metadata jsonb,
  distancia float
)
language sql
security definer
stable
as $$
  select
    ec.id,
    ec.fonte_tipo,
    ec.fonte_id,
    ec.conteudo,
    ec.metadata,
    ec.embedding <=> p_query_embedding as distancia
  from embeddings_chunks ec
  where (ec.escritorio_id = p_escritorio_id or ec.escritorio_id is null)
    and (p_fonte_tipos is null or ec.fonte_tipo = any(p_fonte_tipos))
  order by
    (ec.embedding <=> p_query_embedding)
      - (0.03 * exp(-extract(epoch from (now() - ec.criado_em)) / (180.0 * 86400)))
  limit greatest(p_match_count, 1)
$$;
