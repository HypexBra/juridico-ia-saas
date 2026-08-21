-- "Caso Inteligente" (Fase 1) — linha do tempo do caso: eventos manuais,
-- gerados por IA, sincronizados do DJEN ou extraídos de documento upload.
-- APPEND-ONLY de propósito (só insert+select, sem update/delete): é
-- histórico/auditoria de "o que aconteceu no caso e quando" — corrigir um
-- evento errado é um novo evento (`tipo_evento = 'correcao'`), nunca um
-- UPDATE que reescreve a história.
create table if not exists eventos_caso (
  id             uuid primary key default gen_random_uuid(),
  escritorio_id  uuid not null references escritorios(id) on delete cascade,
  ficha_caso_id  uuid not null references fichas_caso(id) on delete cascade,
  tipo_evento    varchar(50) not null,
  descricao      text not null,
  data_evento    timestamptz not null default now(),
  origem         varchar(20) not null check (origem in ('manual', 'ia', 'djen', 'documento')),
  -- Aponta pra origem concreta do evento quando aplicável (ex.: id de
  -- `sincronizacoes_djen`, `documentos_conhecimento` etc.) — sem FK
  -- explícita porque a tabela referenciada varia com `origem`.
  referencia_id  uuid,
  criado_por     uuid references perfis(id) on delete set null,
  criado_em      timestamptz not null default now()
);
create index if not exists idx_eventos_caso_escritorio on eventos_caso(escritorio_id);
create index if not exists idx_eventos_caso_ficha_data on eventos_caso(ficha_caso_id, data_evento);

alter table eventos_caso enable row level security;
create policy "eventos_caso_select" on eventos_caso
  for select using (escritorio_id = escritorio_atual());
create policy "eventos_caso_insert" on eventos_caso
  for insert with check (escritorio_id = escritorio_atual());
