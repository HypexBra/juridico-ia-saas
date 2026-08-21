-- "Caso Inteligente" (Fase 1) — junção caso <-> jurisprudência citada.
-- `jurisprudencias` (migration 0008) é tabela PÚBLICA/cross-tenant (sem
-- `escritorio_id`, ingerida via cron com service_role); esta tabela de
-- junção é quem carrega o `escritorio_id` e o isolamento RLS, já que "qual
-- jurisprudência este escritório citou neste caso" é dado privado do
-- tenant mesmo que a jurisprudência em si seja pública.
create table if not exists caso_jurisprudencia_citada (
  id                 uuid primary key default gen_random_uuid(),
  escritorio_id      uuid not null references escritorios(id) on delete cascade,
  ficha_caso_id      uuid not null references fichas_caso(id) on delete cascade,
  jurisprudencia_id  uuid not null references jurisprudencias(id) on delete cascade,
  nota_advogado      text,
  criado_em          timestamptz not null default now(),
  unique (ficha_caso_id, jurisprudencia_id)
);
create index if not exists idx_caso_jurisprudencia_escritorio on caso_jurisprudencia_citada(escritorio_id);
create index if not exists idx_caso_jurisprudencia_ficha on caso_jurisprudencia_citada(ficha_caso_id);
create index if not exists idx_caso_jurisprudencia_jurisprudencia on caso_jurisprudencia_citada(jurisprudencia_id);

alter table caso_jurisprudencia_citada enable row level security;
create policy "caso_jurisprudencia_citada_isolamento" on caso_jurisprudencia_citada
  for all using (escritorio_id = escritorio_atual());
