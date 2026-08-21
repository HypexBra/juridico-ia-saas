-- Pool interno de chaves de API dos provedores de LLM (Gemini/Groq) usado
-- pela própria plataforma para chamar os modelos — troca a leitura hoje
-- feita direto de env vars (GEMINI_API_KEY/GROQ_API_KEY, uma chave fixa por
-- provedor) por um pool com N chaves por provedor, rotação/seleção pela
-- menos usada e desativação automática por rate limit. Extensível: basta
-- inserir uma nova linha para adicionar mais uma chave, sem redeploy.
--
-- Por que esta tabela é DISTINTA de `api_keys` (migration 0018):
-- `api_keys` é o produto virado do avesso — chaves que ESCRITÓRIOS clientes
-- geram para autenticar contra app/api/v1/* (uma chave por tenant, isolada
-- por `escritorio_id`, e por isso só precisa de HASH: a plataforma nunca
-- precisa "usar" a chave do cliente de volta, só comparar hash no lookup).
-- `ia_provider_chaves` é o inverso: é a PLATAFORMA quem possui as chaves e
-- as usa para chamar Gemini/Groq em nome de qualquer escritório — não tem
-- `escritorio_id` porque é um recurso global, compartilhado entre todos os
-- tenants (não é multi-tenant, é infraestrutura interna).
--
-- Por que a chave é CIFRADA e não hash: hash é irreversível por design (bom
-- para `api_keys`, onde só se precisa comparar). Aqui a aplicação PRECISA
-- recuperar a chave em texto puro em runtime para montar a requisição HTTP
-- ao provedor — hash não serve. `chave_cifrada` guarda o resultado de
-- AES-256-GCM (chave de cifragem fora do banco, em env var dedicada, nunca
-- comprometida junto com um dump do Postgres). Cifra/decifra acontece
-- exclusivamente em lib/ia/chaves/pool.ts, via `createAdminClient()`
-- (service_role, bypassa RLS) — é o único módulo do código que já viu uma
-- chave de LLM em texto puro. A RLS abaixo protege apenas a tela de gestão
-- admin (/admin, via client normal de sessão), não o caminho de decifragem.
create table if not exists ia_provider_chaves (
  id                       uuid primary key default gen_random_uuid(),
  provider                 varchar(10) not null check (provider in ('gemini', 'groq')),
  nome                     varchar(100) not null,
  chave_cifrada            text not null,
  ordem                    integer not null default 0,
  rpm_limite               integer not null,
  tpm_limite               integer,
  rpd_limite               integer,
  contador_janela_inicio   timestamptz not null default now(),
  contador_requisicoes     integer not null default 0,
  status                   varchar(30) not null default 'ativa'
                             check (status in ('ativa', 'desativada_temporariamente_por_quota', 'desativada_manual')),
  ultima_falha_em          timestamptz,
  ultima_falha_motivo      text,
  ultima_utilizada_em      timestamptz,
  -- Prévia mascarada (ex: "AIza...ab12") preenchida UMA VEZ no momento da
  -- criação da chave (ver lib/ia/chaves/gestao-actions.ts#criarChaveIa) —
  -- nunca recalculada decifrando `chave_cifrada` de novo, só para a tela de
  -- gestão admin não precisar tocar no ciphertext para exibir algo útil.
  chave_preview            varchar(20),
  -- Cooldown explícito: quando uma chave leva 429/rate-limit,
  -- `registrarFalhaQuota` (lib/ia/chaves/pool.ts) empurra este timestamp
  -- pra frente e a seleção (`selecionar_e_registrar_uso_chave` abaixo) passa
  -- a ignorá-la até aqui — mais simples e explícito do que recalcular uma
  -- janela toda vez a partir de `ultima_falha_em`.
  disponivel_em            timestamptz not null default now(),
  criado_em                timestamptz not null default now(),
  atualizado_em            timestamptz not null default now()
);

-- Caminho de leitura mais quente: lib/ia/chaves/pool.ts busca, a cada
-- chamada de LLM, a chave ATIVA de um `provider` específico, disponível
-- (fora de cooldown) há mais tempo sem uso (round-robin simples) — cobre
-- exatamente o filtro (provider, status, disponivel_em) + ordenação
-- (ultima_utilizada_em) em um único índice.
create index if not exists idx_ia_provider_chaves_selecao
  on ia_provider_chaves (provider, status, disponivel_em, ultima_utilizada_em);

alter table ia_provider_chaves enable row level security;

-- Só a tela de gestão admin (/admin/ia/chaves) acessa esta tabela via RLS
-- normal — o pool de seleção em runtime (lib/ia/chaves/pool.ts) usa
-- `createAdminClient()`/service_role e bypassa esta policy por design (não
-- há `auth.uid()` de sessão no meio de uma chamada de IA em background).
create policy "ia_provider_chaves_admin" on ia_provider_chaves
  for all using (eh_admin_plataforma()) with check (eh_admin_plataforma());

comment on table ia_provider_chaves is
  'Pool interno de chaves de API de provedores de LLM (Gemini/Groq) da própria plataforma — NÃO confundir com api_keys (chaves de cliente por escritório, hash-only). Chave fica cifrada (AES-256-GCM), nunca em hash, pois precisa ser recuperada em texto puro em runtime; cifra/decifra só em lib/ia/chaves/pool.ts via service_role.';
comment on column ia_provider_chaves.chave_cifrada is
  'Chave do provedor cifrada com AES-256-GCM (chave de cifragem em env var fora do banco). Nunca armazenar em texto puro nem logar.';
comment on column ia_provider_chaves.status is
  'ativa: disponível para seleção. desativada_temporariamente_por_quota: rate limit/quota estourado, pool volta a considerá-la após a janela expirar. desativada_manual: intervenção manual via /admin, só reativa por ação explícita.';
comment on column ia_provider_chaves.chave_preview is
  'Prévia mascarada da chave (ex: "AIza...ab12"), gravada uma única vez na criação — a tela /admin/ia-chaves exibe só isto, nunca decifra chave_cifrada de novo para exibição.';
comment on column ia_provider_chaves.disponivel_em is
  'Timestamp de fim de cooldown: seleção de chave (selecionar_e_registrar_uso_chave) exige disponivel_em <= now(). Empurrado para o futuro por registrarFalhaQuota em lib/ia/chaves/pool.ts sempre que a chave leva 429/rate-limit do provedor.';

-- ── View de administração (SEM chave_cifrada) ───────────────────────────
-- A tela /admin/ia-chaves (lib/ia/chaves/gestao-actions.ts#listarChavesIa)
-- lê exclusivamente esta view — nunca a tabela base — para tornar
-- estruturalmente impossível a UI de gestão vazar o ciphertext da chave
-- (defesa em profundidade além do RLS, que já protege a tabela via
-- eh_admin_plataforma() mas não filtra colunas).
create or replace view ia_provider_chaves_admin as
select
  id,
  provider,
  nome,
  ordem,
  rpm_limite,
  tpm_limite,
  rpd_limite,
  contador_janela_inicio,
  contador_requisicoes,
  status,
  ultima_falha_em,
  ultima_falha_motivo,
  ultima_utilizada_em,
  chave_preview,
  disponivel_em,
  criado_em,
  atualizado_em
from ia_provider_chaves;

comment on view ia_provider_chaves_admin is
  'Espelho de ia_provider_chaves SEM a coluna chave_cifrada — única fonte de leitura permitida para a tela de gestão /admin/ia-chaves. RLS da view herda da tabela base (security_invoker via policies de ia_provider_chaves, checadas com o papel do chamador).';

alter view ia_provider_chaves_admin set (security_invoker = on);

-- ── Seleção + registro de uso atômico (chamada via service_role/RPC) ────
-- Concentra em uma única transação, no banco, o que seria uma race
-- condition clássica se feito em duas idas à aplicação (SELECT da menos
-- usada + depois UPDATE do contador): duas instâncias serverless
-- concorrentes poderiam selecionar a MESMA chave e ambas incrementarem a
-- partir do mesmo contador antigo, estourando o rpm_limite sem que o pool
-- percebesse. `FOR UPDATE SKIP LOCKED` resolve isso no nível do Postgres:
-- se uma transação concorrente já travou a linha candidata, esta apenas
-- pula para a próxima em vez de esperar/bloquear.
--
-- `now()` do Postgres (não Date.now() do Node) é a única fonte de tempo
-- usada aqui de propósito — evita clock skew entre instâncias serverless
-- decidindo de forma inconsistente se uma janela de 60s já expirou.
create or replace function selecionar_e_registrar_uso_chave(p_provider varchar)
returns setof ia_provider_chaves
language plpgsql
security definer
as $$
declare
  v_chave ia_provider_chaves%rowtype;
begin
  select *
    into v_chave
    from ia_provider_chaves
   where provider = p_provider
     and status = 'ativa'
     and disponivel_em <= now()
   order by ultima_utilizada_em asc nulls first
     for update skip locked
   limit 1;

  if not found then
    return;
  end if;

  -- Janela de rate-limit (rpm) de 60s expirada: reseta o contador antes de
  -- checar o limite, para não carregar contagem de uma janela já encerrada.
  if v_chave.contador_janela_inicio <= now() - interval '60 seconds' then
    v_chave.contador_janela_inicio := now();
    v_chave.contador_requisicoes := 0;
  end if;

  if v_chave.contador_requisicoes >= v_chave.rpm_limite then
    -- Chave dentro da janela mas já no teto de rpm: não é elegível agora
    -- (evita estourar rate-limit do provedor); o caller (lib/ia/chaves/pool.ts)
    -- trata "nenhuma linha retornada" como pool esgotado para este provider.
    return;
  end if;

  update ia_provider_chaves
     set contador_janela_inicio = v_chave.contador_janela_inicio,
         contador_requisicoes = v_chave.contador_requisicoes + 1,
         ultima_utilizada_em = now(),
         atualizado_em = now()
   where id = v_chave.id
  returning * into v_chave;

  return next v_chave;
end;
$$;

comment on function selecionar_e_registrar_uso_chave(varchar) is
  'Seleciona (FOR UPDATE SKIP LOCKED), incrementa o contador de rpm e retorna a linha (incluindo chave_cifrada) da chave disponível de um provider, tudo em uma transação atômica. Só chamada via service_role/rpc a partir de lib/ia/chaves/pool.ts — quem tem acesso ao resultado desta função vê o ciphertext, nunca a chave decifrada.';

-- ── Registro de falha de quota (cooldown) ────────────────────────────────
-- Companheira de `selecionar_e_registrar_uso_chave`: usa `now()` do
-- Postgres (não Date.now() do Node) para calcular `disponivel_em`, pela
-- mesma razão de evitar clock skew entre instâncias serverless. Chamada por
-- `lib/ia/chaves/pool.ts#registrarFalhaQuota` sempre que gemini.ts/groq.ts
-- detecta um 429/rate-limit real do provedor.
create or replace function registrar_falha_quota_chave_ia(p_chave_id uuid, p_motivo text)
returns void
language sql
security definer
as $$
  update ia_provider_chaves
     set status = 'desativada_temporariamente_por_quota',
         ultima_falha_em = now(),
         ultima_falha_motivo = p_motivo,
         disponivel_em = now() + interval '65 seconds',
         atualizado_em = now()
   where id = p_chave_id;
$$;

comment on function registrar_falha_quota_chave_ia(uuid, text) is
  'Marca uma chave como desativada_temporariamente_por_quota com cooldown de 65s (disponivel_em = now() + 65s, calculado no Postgres). Chamada por lib/ia/chaves/pool.ts#registrarFalhaQuota após 429/rate-limit real do provedor.';
