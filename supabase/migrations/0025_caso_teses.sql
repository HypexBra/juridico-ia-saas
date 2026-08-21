-- "Caso Inteligente" (Fase 1) — teses jurídicas avaliadas para o caso.
-- `historico` guarda a trilha de mudança de status/fundamentação (append de
-- objetos `{ em, status_anterior, status_novo, nota }`) sem precisar de
-- tabela própria — volume por caso é baixo e não há necessidade de query
-- relacional sobre esse histórico, só exibição.
create table if not exists teses_caso (
  id             uuid primary key default gen_random_uuid(),
  escritorio_id  uuid not null references escritorios(id) on delete cascade,
  ficha_caso_id  uuid not null references fichas_caso(id) on delete cascade,
  tese           text not null,
  fundamentacao  text,
  status         varchar(20) not null default 'em_avaliacao' check (status in ('em_avaliacao', 'adotada', 'descartada')),
  historico      jsonb not null default '[]'::jsonb,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
create index if not exists idx_teses_caso_escritorio on teses_caso(escritorio_id);
create index if not exists idx_teses_caso_ficha on teses_caso(ficha_caso_id);

alter table teses_caso enable row level security;
create policy "teses_caso_isolamento" on teses_caso
  for all using (escritorio_id = escritorio_atual());
