-- 0047 — Webhooks de saída (Fase 22, parte técnica do plano Firm: "API/webhooks")
--
-- O escritório cadastra endpoints HTTPS e o sistema notifica eventos de
-- negócio (prazo criado/atualizado, caso criado/atualizado, documento
-- analisado) via POST assinado com HMAC-SHA256. Duas tabelas:
--   * CONFIGURAÇÃO (webhook_endpoints) — URL, segredo de assinatura,
--     lista de eventos de interesse;
--   * ENTREGA (webhook_deliveries) — log auditável de cada tentativa:
--     status, código de resposta HTTP e último erro.
--
-- Decisões estruturais (mesmas da migration 0044):
--   1. `webhook_deliveries` também carrega `escritorio_id` DESNORMALIZADO
--      (padrão multi-tenant do projeto): permite policy RLS única `for all
--      using (escritorio_id = escritorio_atual())` sem join com endpoints.
--   2. Excluir um endpoint apaga as deliveries dele (ON DELETE CASCADE):
--      sem endpoint ativo, o log de entrega não tem dono útil e vira lixo
--      órfão; quem precisa de histórico além do ciclo de vida do endpoint
--      exporta antes de excluir.
--   3. O segredo é persistido em texto puro POR NECESSIDADE FUNCIONAL: é
--      ele quem assina cada payload no momento da entrega (diferente das
--      api_keys, que só precisam de hash porque são verificadas por nós).
--      A RLS restringe a leitura a membros do próprio escritório; a UI só
--      o exibe na criação.
--   4. Retry automático NÃO tem coluna própria nesta leva: `tentativas` +
--      `lib/webhooks/deliver.ts#calcularProximaTentativa` (backoff
--      exponencial puro) serão consumidos por um cron futuro.

-- ── 1) Configuração ─────────────────────────────────────────────────────

create table if not exists webhook_endpoints (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references escritorios(id) on delete cascade,
  -- Somente https: o payload assinado carrega dados de processo jurídico
  -- e nunca pode trafegar em texto claro nem para hosts internos
  -- (a validação de SSRF em runtime vive em lib/webhooks/deliver.ts).
  url           text not null check (url ~* '^https://'),
  -- '{all}' = recebe todos os eventos; caso contrário, subconjunto dos
  -- EVENTOS_WEBHOOK definidos em lib/webhooks/deliver.ts.
  eventos       text[] not null default '{all}',
  secret        text not null,
  ativo         boolean not null default true,
  descricao     text,
  criado_em     timestamptz not null default now()
);

comment on table webhook_endpoints is 'Fase 22: endpoints HTTPS de webhook de saída por escritório; entregas assinadas com HMAC-SHA256 (X-JuridicoIA-Signature).';
comment on column webhook_endpoints.eventos is 'Subconjunto de lib/webhooks/deliver.ts#EVENTOS_WEBHOOK ou {all} para todos.';
comment on column webhook_endpoints.secret is 'Token aleatório de 32 bytes (hex) usado como chave HMAC-SHA256 da assinatura — exibido na UI apenas na criação.';

create index if not exists idx_webhook_endpoints_escritorio on webhook_endpoints(escritorio_id);

-- ── 2) Entregas (log auditável por tentativa) ───────────────────────────

create table if not exists webhook_deliveries (
  id              uuid primary key default gen_random_uuid(),
  escritorio_id   uuid not null references escritorios(id) on delete cascade,
  endpoint_id     uuid not null references webhook_endpoints(id) on delete cascade,
  evento          text not null,
  payload         jsonb not null,
  status          varchar(10) not null default 'pendente' check (status in ('pendente','entregue','falha')),
  tentativas      int not null default 0,
  resposta_status int,
  ultimo_erro     text,
  criado_em       timestamptz not null default now(),
  entregue_em     timestamptz
);

comment on table webhook_deliveries is 'Fase 22: log de cada entrega de webhook — status pendente/entregue/falha, código HTTP de resposta e último erro.';
comment on column webhook_deliveries.tentativas is 'Número de tentativas realizadas; o cron futuro de retry usa este campo + calcularProximaTentativa (backoff exponencial).';

create index if not exists idx_webhook_deliveries_endpoint_criado on webhook_deliveries(endpoint_id, criado_em desc);
create index if not exists idx_webhook_deliveries_escritorio on webhook_deliveries(escritorio_id);

-- ── 3) Isolamento multi-tenant (UMA policy por tabela, padrão do projeto) ──

alter table webhook_endpoints enable row level security;
create policy "webhook_endpoints_isolamento" on webhook_endpoints
  for all using (escritorio_id = escritorio_atual());

alter table webhook_deliveries enable row level security;
create policy "webhook_deliveries_isolamento" on webhook_deliveries
  for all using (escritorio_id = escritorio_atual());
