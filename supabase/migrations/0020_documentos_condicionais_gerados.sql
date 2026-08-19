-- Automação de documento com lógica condicional (feature Pro
-- "automacao_documento_condicional", ver lib/planos/gating.ts) — evolução do
-- mail-merge literal 1-clique (`peticoes_geradas`, migration 0010): aqui o
-- modelo pode ter blocos `{{#se ...}}`/`{{#cada ...}}` avaliados pelo motor
-- puro `lib/mailmerge-condicional/motor.ts` contra MÚLTIPLAS fontes de dados
-- (ficha + todos os contratos/parcelas/prazos, não só o mais recente).
--
-- Tabela de auditoria SEPARADA de `peticoes_geradas` (não reaproveitada)
-- porque o formato do diagnóstico é diferente o suficiente para merecer
-- schema próprio: aqui guardamos também `variaveis_nao_resolvidas` (o
-- mail-merge simples só reporta isso em runtime pra UI, nunca persiste),
-- útil para auditar depois quais gerações condicionais saíram com lacunas.
create table if not exists documentos_condicionais_gerados (
  id                       uuid primary key default gen_random_uuid(),
  escritorio_id            uuid not null references escritorios(id) on delete cascade,
  modelo_id                uuid not null references modelos(id) on delete cascade,
  ficha_caso_id            uuid not null references fichas_caso(id) on delete cascade,
  gerado_por               uuid references perfis(id) on delete set null,
  -- Snapshot nome->valor das variáveis simples de fato substituídas na
  -- última resolução (mesmo contrato de `peticoes_geradas.variaveis_usadas`).
  variaveis_usadas         jsonb not null default '{}'::jsonb,
  -- Nomes de variável/condição/coleção que NÃO puderam ser resolvidos
  -- (`ResultadoMailMergeCondicional.variaveisNaoResolvidas`) — persistido
  -- aqui (diferente do mail-merge simples) porque a geração condicional
  -- envolve múltiplas fontes de dados e vale auditar lacunas recorrentes.
  variaveis_nao_resolvidas jsonb not null default '[]'::jsonb,
  criado_em                timestamptz not null default now()
);
create index if not exists idx_documentos_condicionais_escritorio on documentos_condicionais_gerados(escritorio_id);
create index if not exists idx_documentos_condicionais_ficha on documentos_condicionais_gerados(ficha_caso_id);
create index if not exists idx_documentos_condicionais_modelo on documentos_condicionais_gerados(modelo_id);

alter table documentos_condicionais_gerados enable row level security;
create policy "documentos_condicionais_gerados_isolamento" on documentos_condicionais_gerados
  for all using (escritorio_id = escritorio_atual());
