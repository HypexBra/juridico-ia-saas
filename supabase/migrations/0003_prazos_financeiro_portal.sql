-- Suporte de schema para: (1) prazo automático via DJEN + numero CNJ,
-- (2) portal do cliente (auth próprio, fora de `perfis`), (3) financeiro/
-- honorários, (4) rastreamento de assinatura eletrônica, (5) notificações
-- ao cliente. Só schema — lógica de aplicação/integração fica para outros
-- agentes (ver CLAUDE.md deste projeto).

-- ── 1. Prazo automático via DJEN ────────────────────────────────────────
-- numero_processo_cnj segue o padrão NNNNNNN-DD.AAAA.J.TR.OOOO (Resolução
-- CNJ 65/2008); mantido como varchar livre (sem CHECK de regex) porque
-- processos antigos/administrativos às vezes fogem do padrão e validação
-- rígida é responsabilidade da camada de aplicação (zod), não do banco.
-- ficha_caso_id: prazos hoje só têm `cliente_nome`/`processo` em texto livre,
-- sem vínculo estruturado a fichas_caso. Necessário (nullable, expand-only)
-- para o portal do cliente resolver "meus prazos" e para o DJEN casar a
-- intimação com o caso certo.
alter table prazos add column if not exists ficha_caso_id uuid references fichas_caso(id) on delete set null;
create index if not exists idx_prazos_ficha_caso on prazos(ficha_caso_id);
alter table prazos add column if not exists numero_processo_cnj varchar(25);
alter table prazos add column if not exists origem varchar(20) not null default 'manual'
  check (origem in ('manual', 'djen', 'importado'));
alter table prazos add column if not exists tribunal varchar(20);
alter table prazos add column if not exists data_intimacao date;
alter table prazos add column if not exists prazo_em_dobro boolean not null default false;
create index if not exists idx_prazos_numero_cnj on prazos(numero_processo_cnj);

-- Registra, por OAB consultada, a última sincronização feita contra a API
-- do DJEN (Diário de Justiça Eletrônico Nacional) e o último id de
-- comunicação processado — evita reconsultar/reprocessar a mesma
-- intimação a cada polling.
create table if not exists sincronizacoes_djen (
  id                          uuid primary key default gen_random_uuid(),
  escritorio_id               uuid not null references escritorios(id) on delete cascade,
  oab_consultada              varchar(20) not null,
  ultima_consulta_em          timestamptz,
  ultimo_id_comunicacao_processado varchar(100),
  criado_em                   timestamptz not null default now(),
  unique (escritorio_id, oab_consultada)
);
create index if not exists idx_sync_djen_escritorio on sincronizacoes_djen(escritorio_id);

-- ── 2. Portal do cliente ─────────────────────────────────────────────────
-- Cliente final autentica via Supabase Auth (auth.users) com uma conta
-- PRÓPRIA, distinta de `perfis` (que é só para advogados/equipe do
-- escritório). auth_user_id fica null até o convite ser aceito.
create table if not exists clientes_portal (
  id                uuid primary key default gen_random_uuid(),
  escritorio_id     uuid not null references escritorios(id) on delete cascade,
  ficha_caso_id     uuid not null references fichas_caso(id) on delete cascade,
  auth_user_id      uuid references auth.users(id) on delete set null,
  nome              varchar(255) not null,
  email             varchar(255) not null unique,
  token_convite      varchar(100),
  convite_expira_em timestamptz,
  criado_em         timestamptz not null default now()
);
create index if not exists idx_clientes_portal_escritorio on clientes_portal(escritorio_id);
create index if not exists idx_clientes_portal_ficha on clientes_portal(ficha_caso_id);
create index if not exists idx_clientes_portal_auth_user on clientes_portal(auth_user_id);

-- Função auxiliar: id(s) de clientes_portal vinculados ao usuário logado.
-- security definer para poder ser reutilizada nas policies de ficha/prazo
-- sem reavaliação recursiva de RLS.
create or replace function ficha_ids_do_cliente_portal()
returns setof uuid
language sql
security definer
stable
as $$
  select ficha_caso_id from clientes_portal where auth_user_id = auth.uid()
$$;

-- ── 3. Financeiro / honorários ───────────────────────────────────────────
create table if not exists contratos_honorario (
  id               uuid primary key default gen_random_uuid(),
  escritorio_id    uuid not null references escritorios(id) on delete cascade,
  ficha_caso_id    uuid not null references fichas_caso(id) on delete cascade,
  tipo             varchar(20) not null check (tipo in ('fixo', 'exito', 'aaj')),
  valor_total      numeric(14, 2),
  percentual_exito numeric(5, 2),
  criado_em        timestamptz not null default now()
);
create index if not exists idx_contratos_honorario_escritorio on contratos_honorario(escritorio_id);
create index if not exists idx_contratos_honorario_ficha on contratos_honorario(ficha_caso_id);

create table if not exists parcelas_honorario (
  id             uuid primary key default gen_random_uuid(),
  escritorio_id  uuid not null references escritorios(id) on delete cascade,
  contrato_id    uuid not null references contratos_honorario(id) on delete cascade,
  numero_parcela integer not null,
  valor          numeric(14, 2) not null,
  vencimento     date not null,
  status         varchar(20) not null default 'pendente' check (status in ('pendente', 'pago', 'atrasado')),
  pago_em        date,
  criado_em      timestamptz not null default now(),
  unique (contrato_id, numero_parcela)
);
create index if not exists idx_parcelas_honorario_escritorio on parcelas_honorario(escritorio_id);
create index if not exists idx_parcelas_honorario_contrato on parcelas_honorario(contrato_id);
create index if not exists idx_parcelas_honorario_vencimento on parcelas_honorario(vencimento);

-- Rateio entre sócios/advogados de cada contrato. Regra de negócio: a soma
-- de `percentual` de todas as linhas de um mesmo contrato deve fechar em
-- 100 — validada na camada de aplicação (zod/server action) no momento do
-- insert/update em lote, não como CHECK constraint aqui, porque Postgres
-- não permite CHECK que agregue múltiplas linhas da própria tabela sem
-- trigger; um trigger de soma a cada INSERT/UPDATE/DELETE seria overkill
-- para o volume esperado (poucas linhas por contrato).
create table if not exists rateio_socios (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references escritorios(id) on delete cascade,
  contrato_id   uuid not null references contratos_honorario(id) on delete cascade,
  perfil_id     uuid not null references perfis(id) on delete cascade,
  percentual    numeric(5, 2) not null check (percentual > 0 and percentual <= 100),
  criado_em     timestamptz not null default now(),
  unique (contrato_id, perfil_id)
);
create index if not exists idx_rateio_socios_escritorio on rateio_socios(escritorio_id);
create index if not exists idx_rateio_socios_contrato on rateio_socios(contrato_id);
create index if not exists idx_rateio_socios_perfil on rateio_socios(perfil_id);

-- ── 4. Assinatura eletrônica ─────────────────────────────────────────────
-- Só rastreamento de status/provedor — a chamada de API (Clicksign/
-- Autentique) é responsabilidade da camada de aplicação.
create table if not exists documentos_para_assinatura (
  id                  uuid primary key default gen_random_uuid(),
  escritorio_id       uuid not null references escritorios(id) on delete cascade,
  ficha_caso_id       uuid references fichas_caso(id) on delete set null,
  criado_por          uuid references perfis(id) on delete set null,
  nome_documento      varchar(255) not null,
  arquivo_gerado_em   timestamptz,
  status              varchar(20) not null default 'rascunho'
                      check (status in ('rascunho', 'aguardando_assinatura', 'assinado', 'recusado')),
  provedor            varchar(30) check (provedor in ('clicksign', 'autentique')),
  id_externo_provedor varchar(100),
  signatarios         jsonb not null default '[]'::jsonb, -- [{nome, email, status}]
  criado_em           timestamptz not null default now()
);
create index if not exists idx_docs_assinatura_escritorio on documentos_para_assinatura(escritorio_id);
create index if not exists idx_docs_assinatura_ficha on documentos_para_assinatura(ficha_caso_id);
create index if not exists idx_docs_assinatura_status on documentos_para_assinatura(status);

-- ── 5. Notificação automática ao cliente ────────────────────────────────
create table if not exists notificacoes_cliente (
  id                uuid primary key default gen_random_uuid(),
  escritorio_id     uuid not null references escritorios(id) on delete cascade,
  cliente_portal_id uuid not null references clientes_portal(id) on delete cascade,
  ficha_caso_id     uuid references fichas_caso(id) on delete cascade,
  tipo              varchar(30) not null,
  mensagem          text not null,
  lida              boolean not null default false,
  enviada_em        timestamptz,
  criado_em         timestamptz not null default now()
);
create index if not exists idx_notif_cliente_escritorio on notificacoes_cliente(escritorio_id);
create index if not exists idx_notif_cliente_portal on notificacoes_cliente(cliente_portal_id);
create index if not exists idx_notif_cliente_ficha on notificacoes_cliente(ficha_caso_id);

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table sincronizacoes_djen enable row level security;
alter table clientes_portal enable row level security;
alter table contratos_honorario enable row level security;
alter table parcelas_honorario enable row level security;
alter table rateio_socios enable row level security;
alter table documentos_para_assinatura enable row level security;
alter table notificacoes_cliente enable row level security;

create policy "sincronizacoes_djen_isolamento" on sincronizacoes_djen
  for all using (escritorio_id = escritorio_atual());

-- Equipe do escritório gerencia os clientes do portal normalmente.
create policy "clientes_portal_isolamento_equipe" on clientes_portal
  for all using (escritorio_id = escritorio_atual());

-- Cliente final só enxerga a PRÓPRIA linha (necessário para o app do
-- portal resolver seu próprio cliente_portal_id/ficha_caso_id no login).
create policy "clientes_portal_self_select" on clientes_portal
  for select using (auth_user_id = auth.uid());

create policy "contratos_honorario_isolamento" on contratos_honorario
  for all using (escritorio_id = escritorio_atual());

create policy "parcelas_honorario_isolamento" on parcelas_honorario
  for all using (escritorio_id = escritorio_atual());

create policy "rateio_socios_isolamento" on rateio_socios
  for all using (escritorio_id = escritorio_atual());

create policy "documentos_para_assinatura_isolamento" on documentos_para_assinatura
  for all using (escritorio_id = escritorio_atual());

create policy "notificacoes_cliente_isolamento_equipe" on notificacoes_cliente
  for all using (escritorio_id = escritorio_atual());

-- Cliente final só lê (e marca como lida) as próprias notificações.
create policy "notificacoes_cliente_self_select" on notificacoes_cliente
  for select using (cliente_portal_id in (select id from clientes_portal where auth_user_id = auth.uid()));

create policy "notificacoes_cliente_self_update" on notificacoes_cliente
  for update
  using (cliente_portal_id in (select id from clientes_portal where auth_user_id = auth.uid()))
  with check (cliente_portal_id in (select id from clientes_portal where auth_user_id = auth.uid()));

-- Cliente final enxerga a própria ficha de caso e os próprios prazos, via
-- policy adicional (as policies já existentes em fichas_caso/prazos
-- continuam valendo para a equipe do escritório; estas são somadas via
-- `for select`, permissivas por padrão em Postgres RLS).
create policy "fichas_caso_select_cliente_portal" on fichas_caso
  for select using (id in (select ficha_ids_do_cliente_portal()));

create policy "prazos_select_cliente_portal" on prazos
  for select using (ficha_caso_id in (select ficha_ids_do_cliente_portal()));
