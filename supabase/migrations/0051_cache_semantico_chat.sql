-- Caching semântico do chat: intercepta perguntas repetidas (ou reformuladas
-- de forma trivial) de conhecimento jurídico GERAL — prazos do CPC, ritos,
-- interpretações sumuladas — antes de pagar uma nova chamada de LLM.
--
-- Escopo deliberadamente ESTREITO por segurança/precisão jurídica:
--   1. Só é consultado/preenchido quando `modo = 'interno'` (ver
--      lib/ia/roteador-contexto.ts) — ou seja, a própria pergunta já foi
--      classificada como NÃO dependente de contexto do escritório (RAG) nem
--      de informação que muda no tempo (pesquisa web). Perguntas sobre um
--      caso específico ou que exigem estado atual NUNCA passam por aqui.
--   2. Escopado por escritorio_id (mesmo padrão de isolamento multi-tenant
--      de `embeddings_chunks`) — não é um cache compartilhado entre
--      escritórios, mesmo a pergunta sendo genérica. Reduz a taxa de acerto
--      em troca de nunca precisar justificar por que a resposta de um
--      escritório "vazou" pra outro através do cache.
--   3. TTL curto (30 dias, aplicado na função de busca, não por job de
--      limpeza): entendimento jurídico muda; uma resposta cacheada não deve
--      sobreviver indefinidamente só porque ninguém perguntou de novo.
create table if not exists respostas_cache_semantico (
  id                uuid primary key default gen_random_uuid(),
  escritorio_id     uuid not null references escritorios(id) on delete cascade,
  pergunta          text not null,
  pergunta_embedding vector(768) not null,
  resposta          text not null,
  tokens_in         integer not null default 0,
  tokens_out        integer not null default 0,
  modelo            varchar(60),
  criado_em         timestamptz not null default now()
);

create index if not exists idx_cache_semantico_escritorio on respostas_cache_semantico(escritorio_id);
create index if not exists idx_cache_semantico_vetor on respostas_cache_semantico
  using ivfflat (pergunta_embedding vector_cosine_ops) with (lists = 50);

alter table respostas_cache_semantico enable row level security;
create policy "cache_semantico_isolamento" on respostas_cache_semantico
  for all using (escritorio_id = escritorio_atual());

-- Busca o cache-hit mais próximo, se houver, dentro do TTL e do corte de
-- similaridade. `1 - distancia_cosseno` é usado como proxy de similaridade
-- (exato só para vetores normalizados — aproximação aceitável aqui: o pior
-- caso é o corte ficar um pouco mais/menos permissivo do que o número
-- sugere, nunca uma inversão de sentido).
create or replace function buscar_resposta_cache_semantico(
  p_escritorio_id uuid,
  p_query_embedding vector(768),
  p_similaridade_minima float default 0.96,
  p_ttl_dias int default 30
)
returns table (
  id uuid,
  resposta text,
  tokens_in integer,
  tokens_out integer,
  modelo varchar,
  similaridade float
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select
    rc.id,
    rc.resposta,
    rc.tokens_in,
    rc.tokens_out,
    rc.modelo,
    1 - (rc.pergunta_embedding <=> p_query_embedding) as similaridade
  from respostas_cache_semantico rc
  where rc.escritorio_id = p_escritorio_id
    and rc.criado_em >= now() - make_interval(days => greatest(p_ttl_dias, 1))
    and (1 - (rc.pergunta_embedding <=> p_query_embedding)) >= p_similaridade_minima
  order by rc.pergunta_embedding <=> p_query_embedding
  limit 1
$$;
