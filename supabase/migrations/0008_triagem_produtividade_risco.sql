-- Schema para 6 features aprovadas: (1) triagem automática de lead público,
-- (2) lembrete via WhatsApp (Meta Cloud API), (3) relatório de produtividade
-- por advogado — SEM schema novo, ver nota no final do arquivo, (4) score de
-- risco do caso, (5) jurisprudência (STF/STJ) como fonte adicional do RAG,
-- (6) consulta pública por CPF no portal do cliente. Só schema — lógica de
-- aplicação/integração fica para outros agentes (ver CLAUDE.md deste projeto).

-- ── 1. Triagem automática de lead (formulário público, sem autenticação) ──
-- Este deploy é multi-tenant: várias escritorios podem publicar sua própria
-- página pública de triagem (ex: `/triagem/[slug]`, a criar na camada de
-- aplicação). `escritorios.slug` (0001) já existe e é único — é o único
-- identificador seguro de expor num link público, então a página de triagem
-- resolve `escritorio_id` a partir do slug via a função abaixo, nunca
-- expondo a tabela `escritorios` inteira (que tem `plano`, dado interno).
create or replace function escritorio_publico_por_slug(p_slug varchar)
returns table (id uuid, nome varchar)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select e.id, e.nome from escritorios e where e.slug = p_slug limit 1
$$;
grant execute on function escritorio_publico_por_slug(varchar) to anon, authenticated;

-- Submissão pública de lead, antes de virar `fichas_caso`. IA pré-analisa
-- (tipo de caso, urgência, viabilidade) o relato bruto do lead; a equipe do
-- escritório decide se converte em ficha (`ficha_caso_id` fica null até lá).
-- Sem vínculo com `clientes`/`conversas` porque o lead ainda não é cliente
-- (evita poluir essas tabelas com submissões de spam/teste do formulário
-- público antes de qualquer triagem humana).
create table if not exists leads_triagem_publica (
  id                uuid primary key default gen_random_uuid(),
  escritorio_id     uuid not null references escritorios(id) on delete cascade,
  nome              varchar(255) not null,
  telefone          varchar(20),
  email             varchar(255),
  relato            text not null,
  -- Pré-análise da IA, gerada de forma assíncrona logo após o insert
  -- (camada de aplicação); ficam null até o processamento terminar.
  tipo_caso_ia      varchar(100),
  urgencia_ia       varchar(20) check (urgencia_ia in ('baixa', 'normal', 'alta')),
  viabilidade_ia    varchar(20) check (viabilidade_ia in ('baixa', 'media', 'alta')),
  resumo_ia         text,
  status            varchar(20) not null default 'novo'
                    check (status in ('novo', 'em_analise', 'convertido', 'descartado')),
  ficha_caso_id     uuid references fichas_caso(id) on delete set null,
  ip_origem         varchar(45), -- IPv4/IPv6 do submitter, uso exclusivo anti-abuso/rate-limit na app
  criado_em         timestamptz not null default now()
);
create index if not exists idx_leads_triagem_escritorio on leads_triagem_publica(escritorio_id);
create index if not exists idx_leads_triagem_status on leads_triagem_publica(status);

alter table leads_triagem_publica enable row level security;

-- INSERT é a única operação que o visitante anônimo do site pode fazer.
-- Não há WITH CHECK além da FK (qualquer escritorio_id válido é aceito —
-- é exatamente o objetivo: qualquer visitante da página pública de UM
-- escritório específico consegue enviar sua triagem). Rate limiting e
-- validação anti-spam (honeypot/captcha) ficam na camada de aplicação, não
-- é responsabilidade do banco.
grant insert on leads_triagem_publica to anon;
create policy "leads_triagem_insert_publico" on leads_triagem_publica
  for insert to anon with check (true);

-- Equipe do escritório (autenticada) lê e atualiza (ex: mudar status,
-- vincular ficha_caso_id na conversão) só os leads do próprio tenant. O
-- visitante anônimo nunca lê nada de volta — não há policy de select "to
-- anon", então por padrão (RLS restritivo) ele não enxerga sequer o próprio
-- lead após o envio.
create policy "leads_triagem_select_equipe" on leads_triagem_publica
  for select to authenticated using (escritorio_id = escritorio_atual());
create policy "leads_triagem_update_equipe" on leads_triagem_publica
  for update to authenticated
  using (escritorio_id = escritorio_atual())
  with check (escritorio_id = escritorio_atual());

-- ── 2. Lembrete automático via WhatsApp (Meta Cloud API) ────────────────
-- Config do canal por escritório. `token_acesso` é um secret de API de
-- longa duração (Meta Cloud API token) — ARMAZENAR CRIPTOGRAFADO pela
-- camada de aplicação (ex: Supabase Vault/pgsodium ou KMS externo) antes do
-- insert; a coluna aqui é só o espaço para o ciphertext, o banco não faz
-- hash (não é senha, precisa ser recuperável para autenticar na Meta).
create table if not exists canais_whatsapp_escritorio (
  id                uuid primary key default gen_random_uuid(),
  escritorio_id     uuid not null unique references escritorios(id) on delete cascade,
  phone_number_id   varchar(50) not null,  -- ID do número na Meta Cloud API
  token_acesso       text not null,         -- ciphertext (ver comentário acima)
  numero_exibicao   varchar(20),
  ativo             boolean not null default true,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);

-- Log de envios, com chave de idempotência por (tipo_referencia,
-- referencia_id, marco): cada prazo/parcela pode disparar mais de um
-- lembrete ao longo do tempo (ex: D-3, D-1, no dia), mas nunca duas vezes
-- o MESMO marco — é o que o cron de envio consulta antes de disparar.
create table if not exists lembretes_whatsapp_enviados (
  id                  uuid primary key default gen_random_uuid(),
  escritorio_id       uuid not null references escritorios(id) on delete cascade,
  tipo_referencia     varchar(20) not null check (tipo_referencia in ('prazo', 'parcela_honorario')),
  referencia_id       uuid not null, -- id de `prazos` ou `parcelas_honorario`, conforme tipo_referencia
  marco               varchar(10) not null check (marco in ('d3', 'd1', 'd0', 'atraso')),
  telefone_destino    varchar(20) not null,
  status              varchar(20) not null default 'enviado' check (status in ('enviado', 'falhou')),
  mensagem_id_externo varchar(100), -- id retornado pela Meta Cloud API, útil p/ status de entrega
  erro                text,
  criado_em           timestamptz not null default now(),
  unique (tipo_referencia, referencia_id, marco)
);
create index if not exists idx_lembretes_whatsapp_escritorio on lembretes_whatsapp_enviados(escritorio_id);
create index if not exists idx_lembretes_whatsapp_referencia on lembretes_whatsapp_enviados(tipo_referencia, referencia_id);

alter table canais_whatsapp_escritorio enable row level security;
alter table lembretes_whatsapp_enviados enable row level security;

-- Só owner/admin administram o canal (contém secret de API) — advogado
-- comum do escritório não deve ler nem trocar o token. Mesma estrutura de
-- `perfis_update_admin` (0001).
create policy "canais_whatsapp_admin" on canais_whatsapp_escritorio
  for all using (
    escritorio_id = escritorio_atual()
    and exists (
      select 1 from perfis p
      where p.auth_user_id = auth.uid()
        and p.escritorio_id = canais_whatsapp_escritorio.escritorio_id
        and p.role in ('owner', 'admin')
    )
  )
  with check (escritorio_id = escritorio_atual());

-- Envio real dos lembretes roda via cron com `service_role`
-- (createAdminClient, ver app/api/cron/sincronizar-djen/route.ts para o
-- padrão já usado no DJEN) — bypassa RLS, então esta policy só precisa
-- cobrir a LEITURA do histórico pela equipe do escritório.
create policy "lembretes_whatsapp_isolamento" on lembretes_whatsapp_enviados
  for all using (escritorio_id = escritorio_atual());

-- ── 3. Relatório de produtividade por advogado ──────────────────────────
-- NENHUM schema novo necessário. É leitura agregada sobre dados que já
-- existem e já carregam a "ponta" advogado -> registro:
--   - `prazos.criado_por`      (0001) -> advogado que cadastra/cuida do prazo
--   - `rateio_socios.perfil_id` (0003) -> advogado(s) e percentual de cada
--     `contratos_honorario`, que por sua vez liga a `parcelas_honorario`
--     (valor recebido/atrasado) via `contrato_id`
--   - `conversas.criado_por`   (0001) -> advogado que iniciou/assumiu a
--     conversa que originou a `ficha_caso` (via `fichas_caso.conversa_id`)
-- Um relatório de produtividade (nº de casos, prazos cumpridos/atrasados,
-- honorários gerados/recebidos por advogado) é uma VIEW/query agregada na
-- camada de aplicação sobre essas colunas — não precisa de coluna, tabela
-- ou índice novo. `idx_rateio_socios_perfil`, `idx_prazos_escritorio` e
-- `idx_parcelas_honorario_vencimento` (já existentes) cobrem os filtros
-- mais prováveis dessa agregação.

-- ── 4. Score de risco do caso (IA) ───────────────────────────────────────
-- Expand-only: coluna nova, nullable, sem default forçado (fichas
-- existentes ficam sem classificação até o job de IA rodar sobre elas).
alter table fichas_caso add column if not exists nivel_risco varchar(10)
  check (nivel_risco in ('baixo', 'medio', 'alto'));
alter table fichas_caso add column if not exists risco_calculado_em timestamptz;
create index if not exists idx_fichas_nivel_risco on fichas_caso(nivel_risco);

-- ── 5. Jurisprudência (STF/STJ) como fonte adicional do RAG ─────────────
-- Diferente de `documentos_conhecimento` (upload manual, por escritório),
-- jurisprudência pública do STF/STJ é DADO COMPARTILHADO entre todos os
-- tenants: o mesmo acórdão do STF é o mesmo texto pra qualquer escritório,
-- não faz sentido reindexar e duplicar embedding por tenant. Por isso esta
-- tabela NÃO tem `escritorio_id` (é global, ingerida 1x por um job/cron
-- comum, não por escritório).
create table if not exists jurisprudencias (
  id                  uuid primary key default gen_random_uuid(),
  tribunal            varchar(10) not null check (tribunal in ('stf', 'stj')),
  numero_processo     varchar(50) not null,
  classe              varchar(100),
  relator             varchar(255),
  ementa              text not null,
  inteiro_teor_url    text,
  data_julgamento     date,
  data_publicacao     date,
  termo_busca         varchar(255), -- query usada na API pública que trouxe este resultado, p/ auditoria
  criado_em           timestamptz not null default now(),
  unique (tribunal, numero_processo)
);
create index if not exists idx_jurisprudencias_tribunal on jurisprudencias(tribunal);
create index if not exists idx_jurisprudencias_data_julgamento on jurisprudencias(data_julgamento);

alter table jurisprudencias enable row level security;
-- Leitura liberada a QUALQUER usuário autenticado de QUALQUER escritório —
-- é jurisprudência pública, não há isolamento por tenant a aplicar aqui.
-- Sem policy de insert/update/delete para `authenticated`: a ingestão roda
-- via job/cron com `service_role` (mesmo padrão do DJEN), nunca pelo
-- client de um usuário do escritório.
create policy "jurisprudencias_select_authenticated" on jurisprudencias
  for select to authenticated using (true);

-- `embeddings_chunks` (0002) passa a aceitar `fonte_tipo = 'jurisprudencia'`
-- com `fonte_id` apontando para `jurisprudencias.id`. Para esses chunks,
-- `escritorio_id` fica NULL (chunk compartilhado, sem dono) — por isso a
-- coluna precisa deixar de ser NOT NULL, mas só para esse caso específico;
-- o CHECK abaixo garante que todo chunk de fonte não-jurisprudencial
-- CONTINUA exigindo escritorio_id (não afrouxa o isolamento multi-tenant
-- já existente para nenhuma das fontes atuais).
alter table embeddings_chunks alter column escritorio_id drop not null;

alter table embeddings_chunks drop constraint if exists embeddings_chunks_fonte_tipo_check;
alter table embeddings_chunks add constraint embeddings_chunks_fonte_tipo_check
  check (fonte_tipo in ('documento_upload', 'ficha_caso', 'prazo', 'modelo', 'jurisprudencia'));

alter table embeddings_chunks add constraint chk_embeddings_escritorio_por_fonte check (
  (fonte_tipo = 'jurisprudencia' and escritorio_id is null)
  or
  (fonte_tipo <> 'jurisprudencia' and escritorio_id is not null)
);

-- Policy de isolamento original (0002) exigia escritorio_id = escritorio_atual()
-- pra QUALQUER operação — precisa ser trocada por uma versão que também
-- permita LEITURA dos chunks compartilhados (escritorio_id is null), sem
-- abrir insert/update/delete sobre eles para usuários comuns do tenant
-- (a ingestão de jurisprudência, de novo, roda via service_role).
drop policy if exists "embeddings_chunks_isolamento" on embeddings_chunks;
create policy "embeddings_chunks_select" on embeddings_chunks
  for select using (escritorio_id = escritorio_atual() or escritorio_id is null);
create policy "embeddings_chunks_insert" on embeddings_chunks
  for insert with check (escritorio_id = escritorio_atual());
create policy "embeddings_chunks_update" on embeddings_chunks
  for update using (escritorio_id = escritorio_atual()) with check (escritorio_id = escritorio_atual());
create policy "embeddings_chunks_delete" on embeddings_chunks
  for delete using (escritorio_id = escritorio_atual());

-- `buscar_chunks_similares` (0002) precisa passar a enxergar também os
-- chunks compartilhados de jurisprudência na busca por similaridade de
-- QUALQUER escritório, mantendo o isolamento das demais fontes.
create or replace function buscar_chunks_similares(
  p_escritorio_id uuid,
  p_query_embedding vector(768),
  p_match_count int default 6,
  p_fonte_tipos varchar[] default null
)
returns table (
  id uuid,
  fonte_tipo varchar,
  fonte_id uuid,
  conteudo text,
  metadata jsonb,
  distancia float
)
language sql
security definer
stable
as $$
  select
    ec.id,
    ec.fonte_tipo,
    ec.fonte_id,
    ec.conteudo,
    ec.metadata,
    ec.embedding <=> p_query_embedding as distancia
  from embeddings_chunks ec
  where (ec.escritorio_id = p_escritorio_id or ec.escritorio_id is null)
    and (p_fonte_tipos is null or ec.fonte_tipo = any(p_fonte_tipos))
  order by ec.embedding <=> p_query_embedding
  limit greatest(p_match_count, 1)
$$;

-- ── 6. Consulta pública por CPF no portal do cliente ────────────────────
-- CPF vira um identificador de busca em `clientes` (não existia até aqui).
-- Único por escritório (mesma pessoa pode, em tese, ser cliente de mais de
-- UM escritório distinto no mesmo banco multi-tenant — por isso a
-- constraint não é global).
alter table clientes add column if not exists cpf varchar(14);
create unique index if not exists ux_clientes_escritorio_cpf on clientes(escritorio_id, cpf) where cpf is not null;

-- Superfície pública SEM autenticação normal: cliente ainda não tem convite
-- aceito em `clientes_portal`, mas quer confirmar que o caso dele já está
-- em andamento antes de esperar o convite chegar. Deliberadamente uma
-- FUNCTION security definer em vez de RLS direta sobre `clientes`/
-- `fichas_caso` — RLS direta exigiria uma policy "to anon" numa tabela que
-- também guarda telefone/email (clientes) e resumo/estratégia jurídica
-- (fichas_caso), e qualquer erro nessa policy vazaria dado sensível. A
-- function isola exatamente as 4 colunas não sensíveis que podem sair:
-- nome (o próprio solicitante já sabe seu nome), área do direito, data de
-- abertura do caso e um status BEM básico — nunca resumo_fatos,
-- estrategia_ia, questoes_ia, telefone, e-mail ou qualquer dado financeiro
-- (contratos_honorario/parcelas_honorario nem são tocados aqui).
-- Enumeração de CPF é um risco aceito neste nível de schema (mitigar via
-- rate limiting/captcha na camada de aplicação, ver agente `security`).
create or replace function consultar_status_publico_por_cpf(p_escritorio_slug varchar, p_cpf varchar)
returns table (
  nome_cliente    varchar,
  area_direito    varchar,
  status_resumido varchar,
  criado_em       timestamptz
)
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_escritorio_id uuid;
begin
  select e.id into v_escritorio_id from escritorios e where e.slug = p_escritorio_slug limit 1;
  if v_escritorio_id is null then
    return;
  end if;

  return query
  select
    f.nome_cliente,
    f.area_direito,
    case
      when cp.auth_user_id is not null then 'portal_ativo'
      when f.lida then 'em_analise'
      else 'recebido'
    end::varchar as status_resumido,
    f.criado_em
  from clientes c
  join fichas_caso f on f.cliente_id = c.id
  left join clientes_portal cp on cp.ficha_caso_id = f.id
  where c.escritorio_id = v_escritorio_id
    and c.cpf = p_cpf
  order by f.criado_em desc
  limit 5;
end;
$$;
grant execute on function consultar_status_publico_por_cpf(varchar, varchar) to anon, authenticated;
