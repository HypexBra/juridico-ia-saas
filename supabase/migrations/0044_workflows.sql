-- 0044 — Workflow Engine (Fase 8, ADR docs/adrs/0016-workflow-engine.md)
--
-- Automação de rotina por checklist executável: o escritório define UMA vez
-- uma sequência de etapas (criar tarefa/prazo, gerar documento, mensagem ao
-- cliente, aprovação humana) e dispara a execução sobre qualquer ficha de
-- caso. Duas famílias de tabela:
--   * DEFINIÇÃO (workflows + workflow_etapas) — editável, reusável;
--   * EXECUÇÃO (workflow_execucoes + workflow_execucao_etapas) — snapshot
--     imutável por disparo, append-only.
--
-- Decisões estruturais (ver ADR 0016):
--   1. `workflow_execucoes.workflow_id` é ON DELETE SET NULL com SNAPSHOT do
--      nome (`workflow_nome`): excluir um workflow não pode apagar o
--      histórico do que foi executado nos casos (auditoria jurídica).
--   2. `workflow_execucao_etapas.etapa_origem_id` também SET NULL: a etapa
--      da execução guarda cópia própria de título/tipo/configuração — o
--      histórico reflete o que RODOU na época, mesmo que a definição mude.
--   3. TODAS as tabelas carregam `escritorio_id` desnormalizado (padrão
--      multi-tenant do projeto): permite policy RLS única `for all using
--      (escritorio_id = escritorio_atual())` sem join, inclusive nas tabelas
--      filhas.

-- ── 1) Definição ────────────────────────────────────────────────────────

create table if not exists workflows (
  id           uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references escritorios(id) on delete cascade,
  nome         varchar(120) not null,
  descricao    text,
  ativo        boolean not null default true,
  criado_por   uuid references perfis(id) on delete set null,
  criado_em    timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table workflows is 'Fase 8: definição reusável de workflow (sequência ordenada de etapas) por escritório.';

create index if not exists idx_workflows_escritorio on workflows(escritorio_id);

create table if not exists workflow_etapas (
  id          uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references escritorios(id) on delete cascade,
  workflow_id uuid not null references workflows(id) on delete cascade,
  ordem       int not null,
  tipo_acao   varchar(30) not null check (tipo_acao in ('criar_tarefa','criar_prazo','gerar_documento','mensagem_portal','aprovar_humano')),
  titulo      varchar(200) not null,
  configuracao jsonb not null default '{}',
  criado_em   timestamptz not null default now(),
  unique (workflow_id, ordem)
);

comment on column workflow_etapas.configuracao is 'Shape depende de tipo_acao — contrato em lib/workflows/tipos.ts (ConfiguracaoAcao).';

-- Índice composto cobre a leitura canônica (etapas do workflow em ordem);
-- o prefixo workflow_id já serve buscas por pai.
create index if not exists idx_workflow_etapas_escritorio on workflow_etapas(escritorio_id);
create index if not exists idx_workflow_etapas_workflow_ordem on workflow_etapas(workflow_id, ordem);

-- ── 2) Execução (snapshot por disparo) ──────────────────────────────────

create table if not exists workflow_execucoes (
  id           uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references escritorios(id) on delete cascade,
  -- SET NULL de propósito: deletar o workflow NÃO apaga o histórico de
  -- execuções; o nome é congelado aqui para exibição sem join.
  workflow_id  uuid references workflows(id) on delete set null,
  workflow_nome varchar(120) not null,
  ficha_caso_id uuid not null references fichas_caso(id) on delete cascade,
  status       varchar(20) not null default 'em_andamento' check (status in ('em_andamento','concluida','cancelada','falha')),
  iniciada_por uuid references perfis(id) on delete set null,
  criado_em    timestamptz not null default now(),
  concluida_em timestamptz
);

comment on column workflow_execucoes.status is 'Falha numa etapa NÃO encerra a execução: ela segue em_andamento para permitir retry; concluida/cancelada são terminais.';

create index if not exists idx_workflow_execucoes_escritorio_status on workflow_execucoes(escritorio_id, status);
create index if not exists idx_workflow_execucoes_ficha_criado on workflow_execucoes(ficha_caso_id, criado_em desc);

create table if not exists workflow_execucao_etapas (
  id              uuid primary key default gen_random_uuid(),
  escritorio_id   uuid not null references escritorios(id) on delete cascade,
  execucao_id     uuid not null references workflow_execucoes(id) on delete cascade,
  -- Origem na definição pode sumir (edição/exclusão do workflow): snapshot abaixo mantém o registro fiel.
  etapa_origem_id uuid references workflow_etapas(id) on delete set null,
  ordem           int not null,
  tipo_acao       varchar(30) not null check (tipo_acao in ('criar_tarefa','criar_prazo','gerar_documento','mensagem_portal','aprovar_humano')),
  titulo          varchar(200) not null,
  configuracao    jsonb not null default '{}',
  status          varchar(20) not null default 'pendente' check (status in ('pendente','executando','aguardando_humano','concluida','falha','cancelada')),
  -- Ids criados (tarefa/prazo/documento), contagem de mensagens ou {erro} amigável.
  resultado       jsonb,
  executada_em    timestamptz,
  criado_em       timestamptz not null default now()
);

create index if not exists idx_workflow_execucao_etapas_escritorio on workflow_execucao_etapas(escritorio_id);
create index if not exists idx_workflow_execucao_etapas_execucao_ordem on workflow_execucao_etapas(execucao_id, ordem);

-- ── 3) Isolamento multi-tenant (UMA policy por tabela, padrão do projeto) ──

alter table workflows enable row level security;
create policy "workflows_isolamento" on workflows
  for all using (escritorio_id = escritorio_atual());

alter table workflow_etapas enable row level security;
create policy "workflow_etapas_isolamento" on workflow_etapas
  for all using (escritorio_id = escritorio_atual());

alter table workflow_execucoes enable row level security;
create policy "workflow_execucoes_isolamento" on workflow_execucoes
  for all using (escritorio_id = escritorio_atual());

alter table workflow_execucao_etapas enable row level security;
create policy "workflow_execucao_etapas_isolamento" on workflow_execucao_etapas
  for all using (escritorio_id = escritorio_atual());
