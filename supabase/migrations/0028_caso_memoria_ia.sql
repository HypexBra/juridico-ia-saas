-- "Caso Inteligente" (Fase 1) — memória incremental de IA por caso: resumos
-- acumulados, decisões e fatos novos que a IA vai registrando ao longo do
-- tempo, para alimentar contexto de prompts futuros sem reprocessar tudo do
-- zero. APPEND-ONLY (só insert+select) — memória é uma trilha cronológica;
-- "esquecer" um fato errado é registrar uma nova entrada que o supera, não
-- editar/apagar a entrada antiga (preserva auditoria de por que a IA "sabia"
-- algo em determinado momento).
create table if not exists memoria_ia_caso (
  id             uuid primary key default gen_random_uuid(),
  escritorio_id  uuid not null references escritorios(id) on delete cascade,
  ficha_caso_id  uuid not null references fichas_caso(id) on delete cascade,
  tipo_memoria   varchar(30) not null check (tipo_memoria in ('resumo_acumulado', 'decisao', 'fato_novo')),
  conteudo       text not null,
  criado_em      timestamptz not null default now()
);
create index if not exists idx_memoria_ia_caso_escritorio on memoria_ia_caso(escritorio_id);
create index if not exists idx_memoria_ia_caso_ficha_criado on memoria_ia_caso(ficha_caso_id, criado_em desc);

alter table memoria_ia_caso enable row level security;
create policy "memoria_ia_caso_select" on memoria_ia_caso
  for select using (escritorio_id = escritorio_atual());
create policy "memoria_ia_caso_insert" on memoria_ia_caso
  for insert with check (escritorio_id = escritorio_atual());
