-- RAG (retrieval-augmented generation) sobre pgvector + gate de aprovação
-- para ações de escrita propostas pelo agente de IA.
--
-- Duas fontes de conhecimento indexadas na MESMA tabela de chunks:
--   (a) documentos externos upados pelo usuário (legislação/jurisprudência/
--       doutrina em PDF ou texto) — fonte_tipo = 'documento_upload';
--   (b) dados internos já cadastrados no sistema (fichas de caso, prazos,
--       modelos de peça) — fonte_tipo = 'ficha_caso' | 'prazo' | 'modelo'.
-- Dados internos NÃO são reindexados automaticamente a cada escrita (evita
-- acoplar toda action de CRUD existente a uma chamada de embedding síncrona);
-- são (re)indexados sob demanda pela action de reindexação em
-- app/app/base-conhecimento/actions.ts e, pontualmente, logo após uma
-- proposta de create/update ser aprovada (ver app/app/chat/propostas-actions.ts).

create extension if not exists "vector";

-- ── Documentos de base de conhecimento (upload externo) ─────────────────
create table if not exists documentos_conhecimento (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references escritorios(id) on delete cascade,
  criado_por    uuid references perfis(id) on delete set null,
  nome_arquivo  varchar(255) not null,
  tipo_conteudo varchar(50) not null default 'legislacao'
                check (tipo_conteudo in ('legislacao', 'jurisprudencia', 'doutrina', 'outro')),
  status        varchar(20) not null default 'pendente'
                check (status in ('pendente', 'processando', 'pronto', 'erro')),
  total_chunks  integer not null default 0,
  erro          text,
  criado_em     timestamptz not null default now(),
  processado_em timestamptz
);
create index if not exists idx_documentos_conhecimento_escritorio on documentos_conhecimento(escritorio_id);

-- ── Chunks vetorizados (fonte única para o retrieval) ────────────────────
-- embedding: text-embedding-004 (Google) = 768 dimensões.
create table if not exists embeddings_chunks (
  id             uuid primary key default gen_random_uuid(),
  escritorio_id  uuid not null references escritorios(id) on delete cascade,
  fonte_tipo     varchar(30) not null
                 check (fonte_tipo in ('documento_upload', 'ficha_caso', 'prazo', 'modelo')),
  fonte_id       uuid not null, -- id do documento_conhecimento OU da linha original (ficha/prazo/modelo)
  chunk_index    integer not null default 0,
  conteudo       text not null,
  metadata       jsonb not null default '{}'::jsonb, -- ex: {"nome_arquivo": "...", "pagina": 3}
  embedding      vector(768) not null,
  criado_em      timestamptz not null default now()
);
create index if not exists idx_embeddings_escritorio on embeddings_chunks(escritorio_id);
create index if not exists idx_embeddings_fonte on embeddings_chunks(fonte_tipo, fonte_id);
-- ivfflat exige ANALYZE após popular volume razoável; cosine distance é o
-- espaço de similaridade recomendado pelo Google para text-embedding-004.
create index if not exists idx_embeddings_vetor on embeddings_chunks
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Remove todos os chunks de uma fonte antes de reindexar (evita duplicar
-- quando um documento/registro é reprocessado).
create or replace function limpar_chunks_da_fonte(p_fonte_tipo varchar, p_fonte_id uuid)
returns void
language sql
security definer
as $$
  delete from embeddings_chunks where fonte_tipo = p_fonte_tipo and fonte_id = p_fonte_id;
$$;

-- Busca por similaridade restrita ao escritório do chamador (isolamento
-- multi-tenant garantido dentro da própria função, não só por RLS, porque a
-- função roda como security definer para poder usar o índice ivfflat sem
-- reavaliar RLS linha a linha em todo o índice).
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
  where ec.escritorio_id = p_escritorio_id
    and (p_fonte_tipos is null or ec.fonte_tipo = any(p_fonte_tipos))
  order by ec.embedding <=> p_query_embedding
  limit greatest(p_match_count, 1)
$$;

alter table documentos_conhecimento enable row level security;
alter table embeddings_chunks enable row level security;

create policy "documentos_conhecimento_isolamento" on documentos_conhecimento
  for all using (escritorio_id = escritorio_atual());

create policy "embeddings_chunks_isolamento" on embeddings_chunks
  for all using (escritorio_id = escritorio_atual());

-- ── Propostas de ação do agente (gate de aprovação humana) ──────────────
-- Toda ação de escrita sugerida pelo agente (editar ficha/prazo, criar
-- registro, gerar documento) fica pendente aqui ANTES de tocar o banco ou
-- gerar arquivo. Só é executada de fato em
-- app/app/chat/propostas-actions.ts após aprovação explícita do usuário.
create table if not exists propostas_acao (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references escritorios(id) on delete cascade,
  conversa_id   uuid references conversas(id) on delete cascade,
  criado_por    uuid references perfis(id) on delete set null,
  tipo          varchar(30) not null
                check (tipo in (
                  'update_ficha', 'update_prazo',
                  'create_ficha', 'create_prazo',
                  'generate_documento'
                )),
  tabela_alvo   varchar(50), -- 'fichas_caso' | 'prazos' | null (generate_documento não escreve tabela de negócio)
  registro_id   uuid,        -- id do registro alvo quando for update; null quando for create/generate
  resumo        text not null,       -- descrição humana da mudança proposta, exibida no card de aprovação
  payload       jsonb not null,      -- dados estruturados e já validados (zod) da ação proposta
  status        varchar(20) not null default 'pending'
                check (status in ('pending', 'approved', 'rejected', 'applied', 'failed', 'expired')),
  erro          text,
  expira_em     timestamptz not null default (now() + interval '24 hours'),
  criado_em     timestamptz not null default now(),
  resolvido_em  timestamptz,
  resolvido_por uuid references perfis(id) on delete set null
);
create index if not exists idx_propostas_escritorio on propostas_acao(escritorio_id);
create index if not exists idx_propostas_conversa on propostas_acao(conversa_id);
create index if not exists idx_propostas_status on propostas_acao(status);

alter table propostas_acao enable row level security;
create policy "propostas_acao_isolamento" on propostas_acao
  for all using (escritorio_id = escritorio_atual());

-- Mensagem do assistente pode referenciar a proposta de ação que ela gerou,
-- para a UI renderizar o card de aprovar/rejeitar junto da resposta.
alter table mensagens add column if not exists proposta_id uuid references propostas_acao(id) on delete set null;
