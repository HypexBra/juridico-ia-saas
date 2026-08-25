-- 0042 — Pesquisa Jurídica Verificável (Fase 7 do roadmap)
--
-- Fonte real confirmada nesta sessão (não é mais "pesquisa de viabilidade"):
-- o Portal de Dados Abertos do STJ (CKAN, dadosabertos.web.stj.jus.br)
-- publica mensalmente os "Espelhos de Acórdão" de TODOS os órgãos julgadores
-- (Corte Especial, 1ª-3ª Seções, 1ª-6ª Turmas) em JSON com TEXTO INTEGRAL da
-- ementa + metadados estruturados: numeroProcesso, numeroRegistro,
-- siglaClasse/descricaoClasse, nomeOrgaoJulgador, ministroRelator,
-- dataDecisao/dataPublicacao, teseJuridica, tema. Licença CC-BY.
--
-- Este arquivo:
--   1. Amplia `jurisprudencias` com os campos novos que agora temos de fonte
--      oficial (órgão julgador, nº de registro STJ, tese firmada, tema
--      repetitivo) e marca a ORIGEM do registro ('manual' vs 'stj_dados_abertos')
--      para auditoria de fonte — nunca misturar ingestão automática com
--      cadastro manual sem rastreio.
--   2. Índice full-text em pt-BR sobre a ementa (coluna gerada tsvector +
--      GIN): busca por palavra-chave SEM embedding — complementa a busca
--      vetorial do RAG (que é semântica) com busca lexical exata, necessária
--      quando o advogado procura um termo técnico literal ("usucapião
--      extraordinária") ou um número de processo.
--   3. Tabela de controle `fontes_stj_sync`: qual arquivo mensal de cada
--      órgão já foi ingerido (idempotência do cron — nunca reprocessar o
--      mesmo JSON duas vezes).

-- ── 1. Colunas novas em jurisprudencias ─────────────────────────────────────
alter table jurisprudencias
  add column if not exists orgao_julgador varchar(120),
  add column if not exists numero_registro varchar(60),
  add column if not exists tese text,
  add column if not exists tema integer,
  add column if not exists origem varchar(30) not null default 'manual'
    check (origem in ('manual', 'stj_dados_abertos'));

comment on column jurisprudencias.orgao_julgador is 'Órgão colegiado julgador conforme dados abertos STJ (ex: CORTE ESPECIAL, PRIMEIRA TURMA).';
comment on column jurisprudencias.origem is 'Rastreabilidade da fonte: manual = cadastro/ingestão manual; stj_dados_abertos = sincronização automática dos Espelhos de Acórdão (CC-BY).';

-- ── 2. Busca lexical pt-BR sobre a ementa ───────────────────────────────────
alter table jurisprudencias
  add column if not exists busca_tsvector tsvector generated always as (
    setweight(to_tsvector('portuguese', coalesce(numero_processo, '')), 'A') ||
    setweight(to_tsvector('portuguese', ementa), 'B')
  ) stored;

create index if not exists idx_jurisprudencias_busca
  on jurisprudencias using gin (busca_tsvector);

-- ── 3. Controle de sincronização por órgão/arquivo ─────────────────────────
create table if not exists fontes_stj_sync (
  id              uuid primary key default gen_random_uuid(),
  dataset_id      varchar(120) not null,          -- id CKAN do dataset (ex: espelhos-de-acordaos-primeira-turma)
  orgao_julgador  varchar(120) not null,
  ultimo_arquivo  varchar(200),                    -- nome do último arquivo ingerido (ex: 20260630.json) — idempotência
  registros_ingeridos integer not null default 0,
  registros_novos     integer not null default 0,
  erros               integer not null default 0,
  ultimo_sync_em      timestamptz,
  criado_em           timestamptz not null default now(),
  unique (dataset_id)
);

alter table fontes_stj_sync enable row level security;
-- Controle interno de operação: leitura para admin autenticado (visibilidade),
-- escrita só via service_role (cron/sync), igual às demais tabelas de sistema.
create policy "fontes_stj_sync_select_authenticated" on fontes_stj_sync
  for select to authenticated using (true);
