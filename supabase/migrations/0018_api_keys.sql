-- API/integrações abertas (feature premium "api_integracoes", ver
-- lib/planos/gating.ts) — chaves de API que escritórios Pro geram para
-- autenticar chamadas server-to-server em app/api/v1/* sem sessão de
-- cookie do Supabase Auth.
--
-- Segurança: NUNCA guardamos a chave em texto puro. `chave_hash` guarda o
-- SHA-256 da chave completa (gerada em lib/apikeys/gerar.ts); a chave em si
-- só existe em memória no momento da criação e é mostrada UMA VEZ na UI. O
-- índice único em `chave_hash` é o que permite lib/apikeys/autenticar.ts
-- fazer o lookup em O(1) sem nunca comparar strings de chave diretamente.
-- `prefixo_visivel` (ex: "jia_live_ab12") é só cosmético, para o usuário
-- reconhecer qual chave é qual numa lista sem expor o segredo.
create table if not exists api_keys (
  id                    uuid primary key default gen_random_uuid(),
  escritorio_id         uuid not null references escritorios(id) on delete cascade,
  nome                  varchar(100) not null,
  chave_hash            varchar(64) not null unique,
  prefixo_visivel       varchar(20) not null,
  ativa                 boolean not null default true,
  criado_por            uuid references perfis(id) on delete set null,
  criado_em             timestamptz not null default now(),
  ultima_utilizacao_em  timestamptz
);
create index if not exists idx_api_keys_escritorio on api_keys(escritorio_id);
-- Usado por lib/apikeys/autenticar.ts em toda chamada a app/api/v1/*: já é
-- coberto pela constraint unique acima, mas o índice nomeado deixa explícito
-- que é o caminho de leitura mais quente desta tabela.
create index if not exists idx_api_keys_chave_hash on api_keys(chave_hash);

alter table api_keys enable row level security;

-- Leitura/gestão pelo próprio escritório (tela /app/perfil) passa pela RLS
-- normal via `escritorio_atual()`. A VALIDAÇÃO da chave em si (rota pública
-- de app/api/v1/*, sem sessão de usuário) roda com `service_role`
-- (createAdminClient(), ver lib/supabase/admin.ts) e portanto bypassa esta
-- policy — é o único caminho legítimo para isso, já que ali não existe
-- auth.uid() para escritorio_atual() resolver.
create policy "api_keys_isolamento" on api_keys
  for all using (escritorio_id = escritorio_atual())
  with check (escritorio_id = escritorio_atual());
