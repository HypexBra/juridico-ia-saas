-- Anotações colaborativas em conversas do chat interno — inspirado na feature
-- da Turivius de anotações em pesquisas salvas (research de concorrentes,
-- ver docs/RAG-OTIMIZACAO.md). Escritórios com mais de um advogado podem
-- deixar comentários numa conversa (ex: "usar esse trecho na petição",
-- "confirmar com o cliente antes") sem precisar de outro canal (WhatsApp,
-- e-mail) fora do produto.
--
-- Tabela própria (não reaproveita `mensagens`): uma anotação NUNCA entra no
-- histórico enviado ao LLM (ver lib/app/chat-shared.ts) — é metadado de
-- colaboração da EQUIPE sobre a conversa, não conteúdo da conversa em si.
create table if not exists anotacoes_conversa (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references escritorios(id) on delete cascade,
  conversa_id   uuid not null references conversas(id) on delete cascade,
  autor_id      uuid not null references perfis(id) on delete cascade,
  texto         varchar(2000) not null check (length(trim(texto)) > 0),
  criado_em     timestamptz not null default now()
);

create index if not exists idx_anotacoes_conversa on anotacoes_conversa(conversa_id, criado_em);

alter table anotacoes_conversa enable row level security;

-- Mesmo isolamento multi-tenant do resto do schema: qualquer perfil do
-- MESMO escritório da conversa pode ler/comentar (colaboração de equipe),
-- nunca de outro escritório.
create policy "anotacoes_conversa_select_escritorio" on anotacoes_conversa
  for select using (escritorio_id = escritorio_atual());

create policy "anotacoes_conversa_insert_escritorio" on anotacoes_conversa
  for insert with check (escritorio_id = escritorio_atual() and autor_id = perfil_atual());

-- Só o próprio autor apaga a própria anotação (mesmo padrão de
-- `excluirMensagemAction`/RLS de conversas — migration 0014).
create policy "anotacoes_conversa_delete_proprio_autor" on anotacoes_conversa
  for delete using (autor_id = perfil_atual());
