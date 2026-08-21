-- Admin da PLATAFORMA (SaaS, cross-tenant) + exclusão de conversas pelo
-- próprio usuário.
--
-- Distinção importante: `perfis.role` (owner/admin/advogado) já existe e é
-- ESCOPADO POR ESCRITÓRIO (a "admin" de um escritório não vê nada de outro
-- escritório, via `escritorio_atual()`). O que este arquivo cria é um nível
-- OUTRO, ortogonal: um operador do SaaS (nós, donos do produto) que precisa
-- enxergar/gerenciar TODOS os escritórios/usuários/conversas. Por isso vive
-- numa tabela própria (`plataforma_admins`), fora de `escritorios`.
--
-- Decisão de arquitetura (ver seção "Segurança" do pedido original): em vez
-- de rotear o painel /admin por `service_role` (que bypassa RLS e exigiria
-- confiar 100% na checagem da aplicação), a autorização é reforçada também
-- no BANCO via políticas RLS adicionais que só liberam acesso cross-tenant
-- quando `eh_admin_plataforma()` é verdadeiro para o `auth.uid()` da sessão.
-- O client usado pelas actions do /admin continua sendo o client normal
-- (com RLS), não o `service_role` — reduz a superfície de algo dar errado.

-- ── perfil_atual(): equivalente a escritorio_atual(), mas retorna o id do
-- próprio perfil. Necessário pra restringir DELETE de conversas ao autor.
create or replace function perfil_atual()
returns uuid
language sql
security definer
stable
as $$
  select id from perfis where auth_user_id = auth.uid()
$$;

-- ── Admins da plataforma ─────────────────────────────────────────────────
create table if not exists plataforma_admins (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid not null unique references auth.users(id) on delete cascade,
  nome          varchar(255) not null,
  email         varchar(255) not null,
  ativo         boolean not null default true,
  criado_por    uuid references plataforma_admins(id) on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists idx_plataforma_admins_auth_user on plataforma_admins(auth_user_id);

create or replace function eh_admin_plataforma()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from plataforma_admins where auth_user_id = auth.uid() and ativo
  )
$$;

-- Trigger de proteção: nunca deixar o sistema sem NENHUM admin ativo (nem
-- por DELETE, nem por UPDATE que desative o último). Backstop no banco —
-- não depende da aplicação lembrar de checar isso em toda mutação.
create or replace function impedir_remocao_ultimo_admin()
returns trigger
language plpgsql
as $$
declare
  restantes_ativos integer;
begin
  if tg_op = 'DELETE' then
    if old.ativo then
      select count(*) into restantes_ativos from plataforma_admins where ativo and id <> old.id;
      if restantes_ativos = 0 then
        raise exception 'Não é possível remover o último administrador da plataforma.';
      end if;
    end if;
    return old;
  end if;

  -- UPDATE: só bloqueia quando a transição é ativo(true) -> ativo(false).
  if old.ativo and not new.ativo then
    select count(*) into restantes_ativos from plataforma_admins where ativo and id <> old.id;
    if restantes_ativos = 0 then
      raise exception 'Não é possível desativar o último administrador da plataforma.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_impedir_remocao_ultimo_admin on plataforma_admins;
create trigger trg_impedir_remocao_ultimo_admin
  before update or delete on plataforma_admins
  for each row execute function impedir_remocao_ultimo_admin();

alter table plataforma_admins enable row level security;

-- Autoconsulta: qualquer usuário autenticado pode checar SE ELE MESMO é
-- admin (não vaza dados de terceiros — só a própria linha), usado pelo
-- guard de acesso ao /admin sem round-trip extra de service_role.
create policy "plataforma_admins_self_select" on plataforma_admins
  for select using (auth_user_id = auth.uid());

-- Lista completa (tela /admin/administradores) só para quem já é admin.
create policy "plataforma_admins_admin_select" on plataforma_admins
  for select using (eh_admin_plataforma());

-- Só admin existente promove/remove outro — nunca autopromoção (um usuário
-- comum nunca satisfaz eh_admin_plataforma(), então nunca passa aqui).
create policy "plataforma_admins_admin_insert" on plataforma_admins
  for insert with check (eh_admin_plataforma());
create policy "plataforma_admins_admin_update" on plataforma_admins
  for update using (eh_admin_plataforma()) with check (eh_admin_plataforma());
create policy "plataforma_admins_admin_delete" on plataforma_admins
  for delete using (eh_admin_plataforma());

-- ── Auditoria administrativa ─────────────────────────────────────────────
create table if not exists admin_logs (
  id             uuid primary key default gen_random_uuid(),
  admin_id       uuid references plataforma_admins(id) on delete set null,
  admin_nome     varchar(255) not null, -- snapshot: sobrevive à remoção do admin
  acao           varchar(60) not null,
  alvo_tipo      varchar(30),
  alvo_id        varchar(100),
  detalhes       jsonb,
  criado_em      timestamptz not null default now()
);
create index if not exists idx_admin_logs_admin on admin_logs(admin_id);
create index if not exists idx_admin_logs_acao on admin_logs(acao);
create index if not exists idx_admin_logs_criado_em on admin_logs(criado_em desc);

alter table admin_logs enable row level security;

create policy "admin_logs_select" on admin_logs
  for select using (eh_admin_plataforma());
-- Insert também exige ser admin (defesa em profundidade — a aplicação já
-- só grava log a partir de uma action que passou pelo guard de admin).
create policy "admin_logs_insert" on admin_logs
  for insert with check (eh_admin_plataforma());
-- Sem policy de update/delete: log de auditoria é append-only por design.

-- ── Acesso cross-tenant do admin da plataforma (só leitura + as mutações
-- explicitamente pedidas) ────────────────────────────────────────────────
-- Permissiva, somada (OR) às policies de isolamento por escritório já
-- existentes — não remove nada do que já funciona para owner/admin/advogado
-- dentro do próprio escritório.
create policy "escritorios_select_admin_plataforma" on escritorios
  for select using (eh_admin_plataforma());

create policy "perfis_select_admin_plataforma" on perfis
  for select using (eh_admin_plataforma());
create policy "perfis_update_admin_plataforma" on perfis
  for update using (eh_admin_plataforma()) with check (eh_admin_plataforma());
-- Exclusão de usuário (seção 7 do pedido): remove só a linha de `perfis`
-- (dados de conversas/prazos/etc ficam preservados via "on delete set
-- null"/"on delete cascade" já definidos em cada FK) — a conta de auth em
-- si (`auth.users`) só é removida quando houver `SUPABASE_SERVICE_ROLE_KEY`
-- configurada (Admin API), documentado em lib/admin/usuarios.ts.
create policy "perfis_delete_admin_plataforma" on perfis
  for delete using (eh_admin_plataforma());

create policy "conversas_select_admin_plataforma" on conversas
  for select using (eh_admin_plataforma());
create policy "conversas_delete_admin_plataforma" on conversas
  for delete using (eh_admin_plataforma());

create policy "mensagens_select_admin_plataforma" on mensagens
  for select using (eh_admin_plataforma());

create policy "assinaturas_select_admin_plataforma" on assinaturas
  for select using (eh_admin_plataforma());

-- ── Exclusão de conversa pelo PRÓPRIO usuário (seção 1 do pedido) ───────
-- `conversas_isolamento` (migration 0001) era `for all` escopada só por
-- escritório — qualquer colega de escritório podia excluir a conversa de
-- outro (o app nunca expunha essa ação, mas a policy permitia). Substituída
-- por policies por comando: SELECT/INSERT/UPDATE continuam por escritório
-- (mantém o comportamento colaborativo já existente do chat em equipe),
-- DELETE passa a exigir também ser o autor (`criado_por`).
drop policy if exists "conversas_isolamento" on conversas;

create policy "conversas_select_isolamento" on conversas
  for select using (escritorio_id = escritorio_atual());
create policy "conversas_insert_isolamento" on conversas
  for insert with check (escritorio_id = escritorio_atual());
create policy "conversas_update_isolamento" on conversas
  for update using (escritorio_id = escritorio_atual()) with check (escritorio_id = escritorio_atual());
create policy "conversas_delete_proprio_autor" on conversas
  for delete using (escritorio_id = escritorio_atual() and criado_por = perfil_atual());

comment on table plataforma_admins is
  'Admins do SaaS (cross-tenant) — NÃO confundir com perfis.role. Bootstrap do primeiro admin: ver docs/adrs/0003-admin-plataforma.md.';
