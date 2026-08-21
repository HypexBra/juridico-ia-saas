-- Infraestrutura de plano/gating + scaffold de billing (Stripe).
--
-- NENHUMA chamada real ao Stripe roda a partir desta migration — ela só
-- prepara o schema para quando `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`
-- existirem (ver app/api/billing/checkout e app/api/webhooks/stripe). O
-- enforcement de acesso por feature continua 100% em `escritorios.plano`
-- (0001, já existente, 'free'|'pro') — decisão consciente de NÃO criar uma
-- tabela `planos`/`features` separada agora: com 2 planos e 6 features
-- fixas, uma matriz estática em `lib/planos/gating.ts` é mais simples de
-- auditar que um join extra por requisição, e a RLS de `escritorios_update`
-- (0001) já garante que só `service_role` (webhook) muda `plano` — nunca o
-- client. Ver ADR docs/adrs/0001-plano-gating-monolito-modular.md e
-- docs/adrs/0002-billing-scaffold-sem-sdk-stripe.md.

-- ── Assinatura Stripe por escritório (1:1) ──────────────────────────────
-- Espelha o estado da subscription no Stripe para auditoria/tela de "minha
-- assinatura". A fonte de verdade para GATING é `escritorios.plano`, não
-- esta tabela — esta tabela é o detalhe de billing que o webhook usa para
-- decidir qual `plano` gravar, não o que o app checa a cada request.
create table if not exists assinaturas (
  id                      uuid primary key default gen_random_uuid(),
  escritorio_id           uuid not null unique references escritorios(id) on delete cascade,
  stripe_customer_id      varchar(255),
  stripe_subscription_id  varchar(255) unique,
  stripe_price_id         varchar(255),
  status                  varchar(20) not null default 'inexistente'
                          check (status in (
                            'inexistente', 'active', 'trialing', 'past_due',
                            'canceled', 'unpaid', 'incomplete', 'incomplete_expired'
                          )),
  current_period_end     timestamptz,
  cancel_at_period_end    boolean not null default false,
  criado_em               timestamptz not null default now(),
  atualizado_em           timestamptz not null default now()
);
create index if not exists idx_assinaturas_stripe_customer on assinaturas(stripe_customer_id);

alter table assinaturas enable row level security;

-- Só leitura pela própria equipe do escritório (ex: tela "minha
-- assinatura"). Toda ESCRITA vem do webhook do Stripe via `service_role`
-- (createAdminClient), que bypassa RLS — mesmo padrão já usado pelo webhook
-- do Autentique (`documentos_para_assinatura`) e pelo cron do DJEN. Não há
-- policy de insert/update/delete "to authenticated" de propósito: o client
-- nunca deve conseguir se auto-declarar "assinante".
create policy "assinaturas_select_equipe" on assinaturas
  for select using (escritorio_id = escritorio_atual());

-- ── Overrides pontuais de feature por escritório ────────────────────────
-- Escape hatch para suporte/comercial: liberar 1 feature premium pra um
-- escritório free (ex: cortesia/POC) ou revogar 1 feature específica de um
-- pro (ex: abuso), sem mexer no `plano` dele nem criar um plano novo só para
-- 1 cliente. Null = sem excecao, usa a matriz padrão plano->features em
-- `lib/planos/gating.ts`. Formato: {"chave_da_feature": true|false}.
alter table escritorios add column if not exists features_overrides jsonb;

comment on column escritorios.features_overrides is
  'Overrides pontuais de feature premium por escritório: {"feature_key": true|false}. Null/chave ausente = sem excecao, usa a matriz padrão plano->features em lib/planos/gating.ts.';

-- Update do próprio escritório (0001) já bloqueia troca de `plano` pelo
-- client via WITH CHECK comparando contra o valor persistido; a mesma regra
-- precisa valer para `features_overrides` (só service_role/suporte concede
-- exceção, nunca o próprio escritório via API do Supabase).
drop policy if exists "escritorios_update" on escritorios;
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
    and features_overrides is not distinct from (select e.features_overrides from escritorios e where e.id = escritorios.id)
  );
