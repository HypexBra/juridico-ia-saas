-- "Caso Inteligente" (Fase 1) — tarefas/checklist operacional do caso,
-- distinto de `prazos` (que tem natureza processual/legal, com regra de
-- dobra do CPC etc. — ver migration 0003/0010). Tarefa aqui é item de
-- trabalho interno da equipe (ex.: "revisar contrato", "ligar pro cliente").
create table if not exists tarefas_caso (
  id                     uuid primary key default gen_random_uuid(),
  escritorio_id          uuid not null references escritorios(id) on delete cascade,
  ficha_caso_id          uuid not null references fichas_caso(id) on delete cascade,
  titulo                 varchar(255) not null,
  responsavel_perfil_id  uuid references perfis(id) on delete set null,
  status                 varchar(20) not null default 'pendente' check (status in ('pendente', 'em_andamento', 'concluida')),
  prazo_opcional         date,
  criado_por             uuid references perfis(id) on delete set null,
  criado_em              timestamptz not null default now(),
  atualizado_em          timestamptz not null default now()
);
create index if not exists idx_tarefas_caso_escritorio on tarefas_caso(escritorio_id);
create index if not exists idx_tarefas_caso_ficha on tarefas_caso(ficha_caso_id);
create index if not exists idx_tarefas_caso_responsavel on tarefas_caso(responsavel_perfil_id);

alter table tarefas_caso enable row level security;
create policy "tarefas_caso_isolamento" on tarefas_caso
  for all using (escritorio_id = escritorio_atual());
