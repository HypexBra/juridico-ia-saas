-- Configurações gerais do SaaS (seção 13 do pedido admin) — só os campos
-- que já têm suporte REAL de aplicação (nunca preenche a tela com toggle
-- que não faz nada): modo de manutenção (bloqueia login/uso de quem não é
-- admin da plataforma) e habilitar/desabilitar novos cadastros. Singleton
-- (1 linha só, id fixo) — não há necessidade de multi-tenant aqui, é
-- configuração do produto inteiro.
create table if not exists configuracoes_plataforma (
  id                          boolean primary key default true check (id), -- garante 1 única linha
  modo_manutencao             boolean not null default false,
  novos_cadastros_habilitados boolean not null default true,
  atualizado_por              uuid references plataforma_admins(id) on delete set null,
  atualizado_em               timestamptz not null default now()
);
insert into configuracoes_plataforma (id) values (true) on conflict (id) do nothing;

alter table configuracoes_plataforma enable row level security;

-- Leitura pública: `modo_manutencao`/`novos_cadastros_habilitados` precisam
-- ser lidos ANTES de saber se quem está acessando é admin (gate de login e
-- de cadastro rodam para qualquer visitante) — não há dado sensível aqui.
create policy "configuracoes_plataforma_select_publico" on configuracoes_plataforma
  for select using (true);

create policy "configuracoes_plataforma_update_admin" on configuracoes_plataforma
  for update using (eh_admin_plataforma()) with check (eh_admin_plataforma());
