-- Schema multi-tenant do Juridico SaaS
-- Cada escritorio é um tenant; toda tabela de negócio carrega escritorio_id
-- e é protegida por Row Level Security (RLS) baseada no perfil do usuário logado.

create extension if not exists "pgcrypto";

-- ── Tenants ────────────────────────────────────────────────────────────
create table if not exists escritorios (
  id          uuid primary key default gen_random_uuid(),
  nome        varchar(255) not null,
  slug        varchar(100) unique not null,
  plano       varchar(20) not null default 'free' check (plano in ('free','pro')),
  criado_em   timestamptz not null default now()
);

-- Perfil de cada usuário autenticado (auth.users é gerenciado pelo Supabase Auth)
create table if not exists perfis (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid not null unique references auth.users(id) on delete cascade,
  escritorio_id uuid not null references escritorios(id) on delete cascade,
  nome          varchar(255) not null,
  role          varchar(20) not null default 'advogado' check (role in ('owner','admin','advogado')),
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now()
);
create index if not exists idx_perfis_escritorio on perfis(escritorio_id);

-- ── Domínio jurídico (adaptado do assistente-juridico-v5, + escritorio_id) ──
create table if not exists tags (
  id            serial primary key,
  escritorio_id uuid not null references escritorios(id) on delete cascade,
  nome          varchar(50) not null,
  cor           varchar(7) default '#6366f1',
  unique (escritorio_id, nome)
);

create table if not exists clientes (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references escritorios(id) on delete cascade,
  nome          varchar(255),
  telefone      varchar(20),
  email         varchar(255),
  tipo          varchar(20) not null default 'externo' check (tipo in ('advogado','externo')),
  criado_em     timestamptz not null default now(),
  ultima_msg    timestamptz not null default now()
);
create index if not exists idx_clientes_escritorio on clientes(escritorio_id);

create table if not exists conversas (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references escritorios(id) on delete cascade,
  cliente_id    uuid references clientes(id) on delete cascade,
  criado_por    uuid references perfis(id) on delete set null,
  tipo          varchar(20) not null default 'interno' check (tipo in ('interno','triagem')),
  status        varchar(20) not null default 'ativa' check (status in ('ativa','triagem_completa','encerrada')),
  titulo        varchar(255),
  iniciada_em   timestamptz not null default now(),
  encerrada_em  timestamptz,
  total_msgs    integer not null default 0
);
create index if not exists idx_conversas_escritorio on conversas(escritorio_id);

create table if not exists conversas_tags (
  conversa_id uuid    references conversas(id) on delete cascade,
  tag_id      integer references tags(id) on delete cascade,
  primary key (conversa_id, tag_id)
);

create table if not exists mensagens (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references escritorios(id) on delete cascade,
  conversa_id   uuid not null references conversas(id) on delete cascade,
  role          varchar(10) not null check (role in ('user','assistant')),
  conteudo      text not null,
  tokens_in     integer default 0,
  tokens_out    integer default 0,
  criado_em     timestamptz not null default now()
);
create index if not exists idx_mensagens_conversa on mensagens(conversa_id);
create index if not exists idx_mensagens_escritorio on mensagens(escritorio_id);

create table if not exists fichas_caso (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references escritorios(id) on delete cascade,
  conversa_id   uuid references conversas(id) on delete cascade,
  cliente_id    uuid references clientes(id) on delete cascade,
  nome_cliente  varchar(255),
  telefone      varchar(20),
  area_direito  varchar(100),
  resumo_fatos  text,
  urgencia      varchar(20) default 'normal' check (urgencia in ('baixa','normal','alta')),
  resumo_ia     text,
  questoes_ia   text,
  estrategia_ia text,
  lida          boolean not null default false,
  criado_em     timestamptz not null default now()
);
create index if not exists idx_fichas_escritorio on fichas_caso(escritorio_id);
create index if not exists idx_fichas_lida on fichas_caso(lida);

create table if not exists prazos (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references escritorios(id) on delete cascade,
  criado_por    uuid references perfis(id) on delete set null,
  titulo        varchar(255) not null,
  descricao     text,
  data_prazo    date not null,
  processo      varchar(100),
  cliente_nome  varchar(255),
  concluido     boolean not null default false,
  criado_em     timestamptz not null default now()
);
create index if not exists idx_prazos_escritorio on prazos(escritorio_id);
create index if not exists idx_prazos_data on prazos(data_prazo);

create table if not exists modelos (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references escritorios(id) on delete cascade,
  criado_por    uuid references perfis(id) on delete set null,
  nome          varchar(255) not null,
  area          varchar(100),
  tipo          varchar(100),
  descricao     text,
  conteudo      text not null,
  uso_count     integer not null default 0,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists idx_modelos_escritorio on modelos(escritorio_id);

create table if not exists uso_ia (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references escritorios(id) on delete cascade,
  conversa_id   uuid references conversas(id) on delete set null,
  tokens_in     integer default 0,
  tokens_out    integer default 0,
  mes_ref       varchar(7) not null,
  criado_em     timestamptz not null default now()
);
create index if not exists idx_uso_ia_mes on uso_ia(escritorio_id, mes_ref);

-- ── RLS: cada usuário só enxerga dados do próprio escritório ────────────
alter table escritorios enable row level security;
alter table perfis enable row level security;
alter table tags enable row level security;
alter table clientes enable row level security;
alter table conversas enable row level security;
alter table conversas_tags enable row level security;
alter table mensagens enable row level security;
alter table fichas_caso enable row level security;
alter table prazos enable row level security;
alter table modelos enable row level security;
alter table uso_ia enable row level security;

create or replace function escritorio_atual()
returns uuid
language sql
security definer
stable
as $$
  select escritorio_id from perfis where auth_user_id = auth.uid()
$$;

-- Onboarding: usuário recém-autenticado ainda não tem perfil, então
-- escritorio_atual() retorna null. Por isso INSERT tem WITH CHECK próprio,
-- separado da leitura/edição (que exige pertencer ao escritório).
create policy "escritorios_select" on escritorios
  for select using (id = escritorio_atual());

-- Só permite criar escritório se o usuário AINDA não tem perfil (onboarding
-- real, não um usuário já existente criando tenants extras) e força plano
-- inicial 'free' (upgrade de plano nunca deve passar por INSERT/UPDATE do
-- client — sempre por rota de servidor com service_role após pagamento).
create policy "escritorios_insert" on escritorios
  for insert with check (
    auth.uid() is not null
    and not exists (select 1 from perfis p where p.auth_user_id = auth.uid())
    and plano = 'free'
  );

-- Update do próprio escritório só pelo owner, e nunca alterando 'plano'
-- pelo client (comparação contra o valor já persistido bloqueia troca de
-- plano via PATCH direto na API do Supabase).
create policy "escritorios_update" on escritorios
  for update using (
    id = escritorio_atual()
    and exists (
      select 1 from perfis p
      where p.auth_user_id = auth.uid() and p.escritorio_id = escritorios.id and p.role = 'owner'
    )
  )
  with check (
    id = escritorio_atual()
    and plano = (select e.plano from escritorios e where e.id = escritorios.id)
  );

create policy "perfis_select" on perfis
  for select using (auth_user_id = auth.uid() or escritorio_id = escritorio_atual());
create policy "perfis_insert" on perfis
  for insert with check (auth_user_id = auth.uid());

-- Usuário só atualiza o PRÓPRIO perfil e nunca a própria role (evita
-- auto-promoção). Owner/admin podem atualizar perfis de colegas do mesmo
-- escritório (ex.: ativar/desativar, mudar role).
create policy "perfis_update_self" on perfis
  for update using (auth_user_id = auth.uid())
  with check (
    auth_user_id = auth.uid()
    and role = (select p.role from perfis p where p.auth_user_id = auth.uid())
  );

create policy "perfis_update_admin" on perfis
  for update using (
    escritorio_id = escritorio_atual()
    and exists (
      select 1 from perfis p
      where p.auth_user_id = auth.uid()
        and p.escritorio_id = perfis.escritorio_id
        and p.role in ('owner','admin')
    )
  )
  with check (escritorio_id = escritorio_atual());

create policy "tags_isolamento" on tags
  for all using (escritorio_id = escritorio_atual());

create policy "clientes_isolamento" on clientes
  for all using (escritorio_id = escritorio_atual());

create policy "conversas_isolamento" on conversas
  for all using (escritorio_id = escritorio_atual());

create policy "conversas_tags_isolamento" on conversas_tags
  for all using (
    conversa_id in (select id from conversas where escritorio_id = escritorio_atual())
  );

create policy "mensagens_isolamento" on mensagens
  for all using (escritorio_id = escritorio_atual());

create policy "fichas_isolamento" on fichas_caso
  for all using (escritorio_id = escritorio_atual());

create policy "prazos_isolamento" on prazos
  for all using (escritorio_id = escritorio_atual());

create policy "modelos_isolamento" on modelos
  for all using (escritorio_id = escritorio_atual());

create policy "uso_ia_isolamento" on uso_ia
  for all using (escritorio_id = escritorio_atual());

-- Tags padrão são inseridas por escritório no momento do cadastro (ver lib/onboarding.ts)
