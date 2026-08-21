-- Chat bidirecional cliente <-> escritório (feature Pro "portal_cliente_rico",
-- ver lib/planos/gating.ts). Tabela NOVA e independente de `conversas`/
-- `mensagens` (chat interno do escritório, multi-tenant sem conceito de
-- cliente externo) — schema deliberadamente simples porque aqui a
-- "conversa" é sempre 1:1 (uma ficha tem no máximo um `cliente_portal`,
-- ver migration 0003) e não precisa de tabela de conversa separada.
create table if not exists mensagens_portal_cliente (
  id                uuid primary key default gen_random_uuid(),
  escritorio_id     uuid not null references escritorios(id) on delete cascade,
  ficha_caso_id     uuid not null references fichas_caso(id) on delete cascade,
  cliente_portal_id uuid not null references clientes_portal(id) on delete cascade,
  remetente         varchar(20) not null check (remetente in ('cliente', 'escritorio')),
  conteudo          text not null,
  lida              boolean not null default false,
  criado_em         timestamptz not null default now()
);
create index if not exists idx_msg_portal_cliente_ficha on mensagens_portal_cliente(ficha_caso_id, criado_em);
create index if not exists idx_msg_portal_cliente_cliente on mensagens_portal_cliente(cliente_portal_id, criado_em);
create index if not exists idx_msg_portal_cliente_escritorio on mensagens_portal_cliente(escritorio_id);

alter table mensagens_portal_cliente enable row level security;

-- Equipe do escritório lê/escreve em qualquer conversa do próprio
-- escritório (mesmo padrão de `notificacoes_cliente_isolamento_equipe`).
create policy "mensagens_portal_cliente_isolamento_equipe" on mensagens_portal_cliente
  for all
  using (escritorio_id = escritorio_atual())
  with check (escritorio_id = escritorio_atual());

-- Cliente final só enxerga mensagens da PRÓPRIA conversa (nunca de outro
-- cliente do mesmo escritório).
create policy "mensagens_portal_cliente_self_select" on mensagens_portal_cliente
  for select
  using (cliente_portal_id in (select id from clientes_portal where auth_user_id = auth.uid()));

-- Cliente final só envia mensagem como 'cliente', na própria conversa —
-- `ficha_caso_id`/`escritorio_id` são derivados da própria linha de
-- `clientes_portal` no WITH CHECK (não confiam no valor enviado pelo
-- client), fechando a possibilidade de um cliente escrever numa ficha que
-- não é a sua mesmo que o app tenha um bug e envie o id errado.
create policy "mensagens_portal_cliente_self_insert" on mensagens_portal_cliente
  for insert
  with check (
    remetente = 'cliente'
    and cliente_portal_id in (select id from clientes_portal where auth_user_id = auth.uid())
    and ficha_caso_id = (select ficha_caso_id from clientes_portal where id = cliente_portal_id)
    and escritorio_id = (select escritorio_id from clientes_portal where id = cliente_portal_id)
  );

-- Habilita Realtime (`postgres_changes`) nesta tabela — necessário para o
-- chat atualizar ao vivo dos dois lados sem reload/polling.
alter publication supabase_realtime add table mensagens_portal_cliente;
