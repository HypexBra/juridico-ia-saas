-- "Caso Inteligente" (Fase 1) — pessoas envolvidas no caso, além do
-- `cliente_id` único que `fichas_caso` já carrega: partes adversas,
-- testemunhas e terceiros interessados, cada um com seu papel processual.
create table if not exists pessoas_caso (
  id                 uuid primary key default gen_random_uuid(),
  escritorio_id      uuid not null references escritorios(id) on delete cascade,
  ficha_caso_id      uuid not null references fichas_caso(id) on delete cascade,
  tipo               varchar(20) not null check (tipo in ('parte', 'adverso', 'testemunha', 'terceiro')),
  nome               varchar(255) not null,
  documento          varchar(50),
  contato            varchar(255),
  papel_processual   varchar(100),
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now()
);
create index if not exists idx_pessoas_caso_escritorio on pessoas_caso(escritorio_id);
create index if not exists idx_pessoas_caso_ficha on pessoas_caso(ficha_caso_id);

alter table pessoas_caso enable row level security;
create policy "pessoas_caso_isolamento" on pessoas_caso
  for all using (escritorio_id = escritorio_atual());
