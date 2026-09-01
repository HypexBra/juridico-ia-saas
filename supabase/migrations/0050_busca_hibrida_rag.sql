-- Busca híbrida (BM25 lexical + vetor) com Reciprocal Rank Fusion no RAG do
-- chat, e suporte a chunk PAI (parent-child chunking).
--
-- Motivação: `buscar_chunks_similares` (0002→0037) é busca vetorial pura.
-- Embeddings bi-encoder colapsam identificadores jurídicos de alta densidade
-- lexical e baixa distinção semântica (número de artigo, número de processo
-- no padrão CNJ, sigla de tribunal, súmula) em vetores próximos de conceitos
-- correlatos — não do texto exato. Uma pergunta sobre "art. 300 do CPC" pode
-- recuperar doutrina geral sobre tutela de urgência sem trazer o texto do
-- próprio artigo, porque nenhum chunk fica "vetorialmente perto" o bastante
-- de um número de artigo isolado.
--
-- Fix: busca lexical (tsvector/GIN, português) complementando a busca
-- vetorial já existente, fundidas por Reciprocal Rank Fusion (RRF) — soma de
-- 1/(k + posição) em cada ranking, k=60 (constante padrão da literatura de
-- RRF). Um chunk bem posicionado em QUALQUER uma das duas buscas sobe no
-- resultado fundido, sem precisar normalizar/comparar escalas de score
-- incompatíveis (ts_rank_cd e distância de cosseno não são comparáveis
-- diretamente).
--
-- Igual precedente já existe em `jurisprudencias.busca_tsvector` (0042),
-- usado pela pesquisa jurídica pública — aqui o mesmo padrão entra na tabela
-- que alimenta o RAG do chat (`embeddings_chunks`).

alter table embeddings_chunks
  add column if not exists busca_lexical tsvector generated always as (
    to_tsvector('portuguese', conteudo)
  ) stored;

create index if not exists idx_embeddings_busca_lexical
  on embeddings_chunks using gin (busca_lexical);

-- Chunk PAI (parent-child chunking): bloco mais amplo que envolve este
-- chunk-filho, preenchido pela ingestão (lib/rag/chunking.ts). A busca e o
-- reranking continuam operando sobre o chunk-filho (preciso, ~1800 chars) —
-- só o texto injetado no prompt final passa a ser o do pai (contexto
-- completo do capítulo/ementa), ver lib/rag/retrieval.ts. NULL para linhas
-- indexadas antes desta migration: cai para usar o próprio `conteudo` como
-- contexto (comportamento idêntico ao anterior), não é preciso reindexar a
-- base inteira para esta migration entrar em vigor.
alter table embeddings_chunks
  add column if not exists conteudo_pai text;

-- Busca híbrida: BM25 (ts_rank_cd sobre busca_lexical) + vetor (pgvector),
-- unificados por RRF. Nome novo (não substitui `buscar_chunks_similares`)
-- porque a assinatura muda (novo parâmetro obrigatório de texto da consulta)
-- — a função antiga fica intacta, sem caller depois deste commit.
create or replace function buscar_chunks_hibrido(
  p_escritorio_id uuid,
  p_query_texto text,
  p_query_embedding vector(768),
  p_match_count int default 6,
  p_fonte_tipos varchar[] default null
)
returns table (
  id uuid,
  fonte_tipo varchar,
  fonte_id uuid,
  conteudo text,
  conteudo_pai text,
  metadata jsonb,
  distancia float,
  rrf_score float
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  with candidatos_base as (
    select ec.id, ec.fonte_tipo, ec.fonte_id, ec.conteudo, ec.conteudo_pai, ec.metadata,
           ec.embedding, ec.busca_lexical, ec.criado_em
    from embeddings_chunks ec
    where (ec.escritorio_id = p_escritorio_id or ec.escritorio_id is null)
      and (p_fonte_tipos is null or ec.fonte_tipo = any(p_fonte_tipos))
  ),
  tsq as (
    select websearch_to_tsquery('portuguese', coalesce(p_query_texto, '')) as q
  ),
  sparse_search as (
    select id, row_number() over (order by rank_lex desc) as rank
    from (
      select cb.id, ts_rank_cd(cb.busca_lexical, tsq.q) as rank_lex
      from candidatos_base cb, tsq
      where tsq.q is not null and cb.busca_lexical @@ tsq.q
    ) x
    order by rank_lex desc
    limit greatest(p_match_count, 1) * 4
  ),
  dense_search as (
    -- Mesmo boost leve de recência de 0037 (meia-vida ~180 dias), mantido
    -- aqui como critério de ranqueamento da rota densa antes da fusão.
    select id, distancia, row_number() over (order by score asc) as rank
    from (
      select cb.id,
             cb.embedding <=> p_query_embedding as distancia,
             (cb.embedding <=> p_query_embedding)
               - (0.03 * exp(-extract(epoch from (now() - cb.criado_em)) / (180.0 * 86400))) as score
      from candidatos_base cb
    ) y
    order by score asc
    limit greatest(p_match_count, 1) * 4
  ),
  fundido as (
    select
      coalesce(s.id, d.id) as id,
      coalesce(1.0 / (60 + s.rank), 0.0) + coalesce(1.0 / (60 + d.rank), 0.0) as rrf_score
    from sparse_search s
    full outer join dense_search d on s.id = d.id
  )
  select
    cb.id, cb.fonte_tipo, cb.fonte_id, cb.conteudo, cb.conteudo_pai, cb.metadata,
    d.distancia,
    f.rrf_score
  from fundido f
  join candidatos_base cb on cb.id = f.id
  left join dense_search d on d.id = f.id
  order by f.rrf_score desc
  limit greatest(p_match_count, 1)
$$;
