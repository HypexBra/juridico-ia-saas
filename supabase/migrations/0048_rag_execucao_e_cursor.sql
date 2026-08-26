-- 0048 · Observabilidade e incrementalidade dos jobs de base jurídica (P0.4)
--
-- Contexto: o projeto JÁ tem três jobs que alimentam a base de conhecimento
-- jurídico (`/api/cron/sincronizar-djen` diário, `/api/cron/sync-stj` mensal,
-- `/api/cron/ingerir-jurisprudencia` manual). O que NÃO existia era o que o
-- critério de aceite do P0.4 exige:
--
--   1. um LOG DE EXECUÇÃO uniforme por fonte (sucesso / sucesso_parcial /
--      erro), para saber que o pipeline rodou e o que ele trouxe. Hoje o
--      rastro é `console.error` no log da Vercel (some na retenção) e, no
--      caso do STJ, uma linha em `fontes_stj_sync` que só guarda o ESTADO
--      final, nunca o histórico de tentativas;
--   2. detecção de "o job parou de rodar". Sem histórico persistido não há
--      como responder "faz mais de 24h que nenhuma execução dessa fonte teve
--      sucesso" · e é exatamente esse o alerta pedido no P0.4;
--   3. um CURSOR de incrementalidade com granularidade de TIMESTAMP por
--      fonte. `fontes_stj_sync.ultimo_arquivo` resolve isso só para o STJ
--      (chave natural = nome do arquivo mensal); o DJEN e qualquer fonte
--      futura de legislação precisam de "desde quando buscar", e uma coluna
--      de DATE não basta se o schedule algum dia passar a rodar mais de uma
--      vez por dia (perderia o que foi publicado entre duas execuções do
--      mesmo dia).
--
-- Escopo deliberado: NÃO cria uma nova tabela de conteúdo vetorial. O RAG
-- deste projeto já é `embeddings_chunks` (vector(768), gemini-embedding-001,
-- migrations 0002/0008/0029/0037) com isolamento multi-tenant no CHECK e nas
-- policies. Uma segunda base vetorial paralela dividiria o retrieval em dois
-- lugares e reabriria o risco de tenant leak que 0008 fechou.

-- ── 1. Cursor de incrementalidade por fonte ─────────────────────────────────
-- Uma linha por fonte lógica ('djen', 'stj_dados_abertos', 'legislacao', ...).
-- `ultima_busca_em` é marcado no INÍCIO da busca, não no fim: se a execução
-- levar 4 minutos, nada publicado durante esses 4 minutos é pulado na
-- próxima rodada (no pior caso é reprocessado, e reprocessar é inofensivo
-- porque a ingestão é idempotente por chave natural / limpar_chunks_da_fonte).
create table if not exists rag_fonte_cursor (
  fonte           varchar(40) primary key,
  ultima_busca_em timestamptz not null,
  atualizado_em   timestamptz not null default now()
);

comment on table rag_fonte_cursor is
  'Checkpoint de incrementalidade por fonte da base jurídica. Timestamp completo (não DATE) para o job continuar correto se passar a rodar mais de 1x/dia. Escrito só via service_role (cron).';
comment on column rag_fonte_cursor.ultima_busca_em is
  'Marcado no INÍCIO da busca da execução anterior, nunca no fim: garante que conteúdo publicado durante o processamento não seja pulado.';

-- ── 2. Log de execução (auditoria + base do alerta de saúde) ────────────────
create table if not exists rag_execucao_log (
  id               uuid primary key default gen_random_uuid(),
  fonte            varchar(40) not null,
  status           varchar(20) not null
                   check (status in ('sucesso', 'sucesso_parcial', 'erro', 'pulado')),
  documentos_novos integer not null default 0,
  documentos_falha integer not null default 0,
  duracao_ms       integer,
  mensagem_erro    text,
  detalhes         jsonb,
  executado_em     timestamptz not null default now()
);

comment on table rag_execucao_log is
  'Histórico append-only de cada execução de cada fonte da base jurídica (P0.4). Nunca faz UPDATE: uma execução = uma linha. Base para o alerta "fonte sem sucesso há mais de N horas".';
comment on column rag_execucao_log.status is
  'sucesso = fonte processada inteira sem falha; sucesso_parcial = terminou mas com falhas pontuais contadas em documentos_falha (nunca silenciosas); erro = fonte abortou; pulado = nada novo a fazer (ex: arquivo mensal do STJ já ingerido).';

-- Consulta canônica do alerta de saúde: "última execução BEM-SUCEDIDA de
-- cada fonte". Index composto na ordem em que a query filtra/ordena.
create index if not exists idx_rag_execucao_log_fonte_data
  on rag_execucao_log (fonte, executado_em desc);
create index if not exists idx_rag_execucao_log_data
  on rag_execucao_log (executado_em desc);

-- ── 3. RLS ─────────────────────────────────────────────────────────────────
-- Mesmo padrão de `fontes_stj_sync` (migration 0042): dado OPERACIONAL da
-- plataforma, não de tenant. Leitura para qualquer usuário autenticado
-- (visibilidade de "a base está atualizada?" na UI, sem expor conteúdo de
-- nenhum escritório · estas tabelas não têm escritorio_id nem conteúdo
-- jurídico, só contadores e nomes de fonte). Escrita: nenhuma policy, o que
-- em RLS significa negado para authenticated/anon · só service_role (cron)
-- escreve, porque service_role bypassa RLS por definição.
alter table rag_fonte_cursor enable row level security;
alter table rag_execucao_log enable row level security;

drop policy if exists "rag_fonte_cursor_select_authenticated" on rag_fonte_cursor;
create policy "rag_fonte_cursor_select_authenticated" on rag_fonte_cursor
  for select to authenticated using (true);

drop policy if exists "rag_execucao_log_select_authenticated" on rag_execucao_log;
create policy "rag_execucao_log_select_authenticated" on rag_execucao_log
  for select to authenticated using (true);

-- ── 4. Saúde das fontes, em uma chamada ────────────────────────────────────
-- Evita N+1 (uma query por fonte) no endpoint de health e no alerta: devolve,
-- para cada fonte que já rodou alguma vez, quando foi a última execução, e
-- quando foi a última execução BEM-SUCEDIDA (sucesso ou sucesso_parcial ·
-- sucesso_parcial conta como "o pipeline está vivo", porque as falhas
-- pontuais dele já ficaram registradas em documentos_falha).
--
-- `security definer` pelo mesmo motivo de `buscar_chunks_similares` (0002):
-- roda a agregação direto no índice sem reavaliar RLS linha a linha. Seguro
-- porque não devolve nenhum dado de tenant · só nome de fonte e timestamps.
create or replace function rag_saude_fontes()
returns table (
  fonte varchar,
  ultima_execucao_em timestamptz,
  ultimo_sucesso_em timestamptz,
  ultimo_status varchar,
  ultima_mensagem_erro text
)
language sql
security definer
stable
set search_path = public
as $$
  select
    l.fonte,
    max(l.executado_em) as ultima_execucao_em,
    max(l.executado_em) filter (where l.status in ('sucesso', 'sucesso_parcial')) as ultimo_sucesso_em,
    (array_agg(l.status order by l.executado_em desc))[1] as ultimo_status,
    (array_agg(l.mensagem_erro order by l.executado_em desc))[1] as ultima_mensagem_erro
  from rag_execucao_log l
  group by l.fonte
$$;

comment on function rag_saude_fontes() is
  'Resumo de saúde por fonte da base jurídica: última execução, último sucesso, último status. Usado pelo alerta do P0.4 ("fonte sem sucesso há mais de 24h") e pela visibilidade na UI.';

revoke all on function rag_saude_fontes() from public;
grant execute on function rag_saude_fontes() to authenticated, service_role;
