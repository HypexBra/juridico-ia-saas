-- Schema para 3 features aprovadas: (1) calculadora de prazo com dobra/
-- feriado forense automática, (2) petição por modelo com variáveis
-- (mail-merge jurídico), (3) dashboard de inadimplência + export pro
-- contador — SEM schema novo, ver nota no final do arquivo. Só schema —
-- lógica de aplicação/integração fica para outros agentes (ver CLAUDE.md
-- deste projeto).

-- ── 1. Calculadora de prazo com dobra/feriado forense automática ────────
-- Feriado nacional (ex: 25/12, 7/9) é o MESMO texto/data pra qualquer
-- escritório do país — dado compartilhado, não faz sentido duplicar por
-- tenant (mesmo raciocínio de `jurisprudencias` em 0008). Feriado estadual/
-- forense (ex: aniversário do TJ de um estado, feriado forense local) varia
-- por UF, então a mesma tabela cobre os dois casos via `abrangencia` +
-- `uf` (nulo quando nacional). Curadoria: cada linha é uma DATA concreta de
-- um ano específico (mesmo os feriados "fixos" tipo 25/12 exigem uma linha
-- por ano, porque `data` é `date`, não "dia/mês recorrente") — o seed abaixo
-- é só BOOTSTRAP do próximo ano, e um job anual da camada de aplicação
-- (mesmo padrão de ingestão via `service_role` já usado para
-- `jurisprudencias`/DJEN) precisa repetir esse insert todo ano para: (a)
-- feriados nacionais fixos do ano seguinte, (b) feriados MÓVEIS (Carnaval,
-- Sexta-feira Santa, Corpus Christi — dependem do cálculo da Páscoa,
-- diferente ano a ano), (c) feriados forenses estaduais específicos de cada
-- TJ/comarca. Calcular a data da Páscoa em SQL puro é possível mas é regra
-- de calendário, não de dado, e fica mais fácil de testar/ajustar em TS do
-- que em plpgsql — por isso a lógica de "somar dias úteis pulando feriados"
-- também fica na aplicação, não neste schema.
create table if not exists feriados_forenses (
  id            uuid primary key default gen_random_uuid(),
  data          date not null,
  abrangencia   varchar(10) not null check (abrangencia in ('nacional', 'estadual')),
  -- Só preenchido quando abrangencia = 'estadual'; nacional vale para
  -- qualquer UF, por isso fica null em vez de repetir a linha 27 vezes.
  uf            varchar(2),
  descricao     varchar(255) not null,
  criado_em     timestamptz not null default now(),
  constraint chk_feriados_forenses_uf_por_abrangencia check (
    (abrangencia = 'nacional' and uf is null)
    or
    (abrangencia = 'estadual' and uf is not null)
  )
);
-- Índice parcial em vez de UNIQUE(data, uf) simples: nacional tem uf NULL e
-- Postgres trata NULL como distinto em UNIQUE normal, então duas linhas
-- nacionais com a mesma data não seriam bloqueadas sem os dois índices
-- parciais abaixo (um por abrangência).
create unique index if not exists ux_feriados_forenses_nacional on feriados_forenses(data) where abrangencia = 'nacional';
create unique index if not exists ux_feriados_forenses_estadual on feriados_forenses(data, uf) where abrangencia = 'estadual';
-- Filtro mais provável do cálculo de prazo: "quais feriados existem entre
-- data_intimacao e data_prazo, para esta UF (ou nacional)".
create index if not exists idx_feriados_forenses_data on feriados_forenses(data);
create index if not exists idx_feriados_forenses_uf on feriados_forenses(uf) where uf is not null;

alter table feriados_forenses enable row level security;
-- Dado compartilhado, só leitura para qualquer usuário autenticado de
-- qualquer escritório — mesma policy shape de `jurisprudencias_select_authenticated`
-- (0008). Sem policy de insert/update/delete para `authenticated`: curadoria
-- roda via seed desta migration + job/cron com `service_role`.
create policy "feriados_forenses_select_authenticated" on feriados_forenses
  for select to authenticated using (true);

-- Seed inicial (bootstrap 2026, ano corrente do deploy): feriados nacionais
-- FIXOS (Lei 6.802/80 + Lei 662/49) que caem sempre na mesma data. Anos
-- seguintes e feriados móveis/estaduais ficam a cargo do job anual (ver
-- comentário acima). `on conflict do nothing` torna o INSERT idempotente (a
-- migration pode rodar mais de uma vez sem duplicar linha nem quebrar).
insert into feriados_forenses (data, abrangencia, uf, descricao) values
  ('2026-01-01', 'nacional', null, 'Confraternização Universal'),
  ('2026-04-21', 'nacional', null, 'Tiradentes'),
  ('2026-05-01', 'nacional', null, 'Dia do Trabalho'),
  ('2026-09-07', 'nacional', null, 'Independência do Brasil'),
  ('2026-10-12', 'nacional', null, 'Nossa Senhora Aparecida'),
  ('2026-11-02', 'nacional', null, 'Finados'),
  ('2026-11-15', 'nacional', null, 'Proclamação da República'),
  ('2026-11-20', 'nacional', null, 'Consciência Negra (feriado nacional desde a Lei 14.759/2023)'),
  ('2026-12-25', 'nacional', null, 'Natal')
on conflict do nothing;

-- Regra de dobra do CPC (Art. 180 Fazenda Pública, Art. 183 Ministério
-- Público, Art. 186 Defensoria Pública — dobro de prazo) depende de QUEM é
-- a parte, não é uma decisão manual solta como o `prazo_em_dobro` boolean
-- que já existe (0003): aquele campo guarda o RESULTADO já calculado
-- (usado hoje só pelo DJEN/import), este campo novo guarda a CAUSA, para a
-- calculadora decidir sozinha se dobra e também poder reexplicar o motivo
-- na tela ("dobrado porque a parte contrária é Fazenda Pública"). Expand-only:
-- nullable, default 'particular' (nenhum prazo antigo muda de comportamento).
alter table prazos add column if not exists parte_contraria_tipo varchar(20) not null default 'particular'
  check (parte_contraria_tipo in ('particular', 'fazenda_publica', 'ministerio_publico', 'defensoria_publica'));
-- UF da comarca/tribunal do processo, para casar com `feriados_forenses.uf`.
-- Distinto de `tribunal` (0003, ex: 'TJSP'), que é a sigla do órgão e nem
-- sempre deixa a UF óbvia de extrair por código (ex: TRFs cobrem >1 estado).
alter table prazos add column if not exists uf varchar(2);
create index if not exists idx_prazos_uf on prazos(uf) where uf is not null;

-- ── 2. Petição por modelo com variáveis (mail-merge jurídico) ───────────
-- `modelos.conteudo` (0001) já é texto livre — NENHUMA mudança de schema
-- necessária para suportar variáveis: a sintaxe `{{variavel}}` dentro do
-- texto é resolvida via regex simples na camada de aplicação (busca
-- `/\{\{(\w+)\}\}/g` e substitui pelo valor correspondente), não exige
-- coluna, tipo ou parser no banco. Contrato de variáveis suportadas
-- (documentado aqui porque é o schema-fonte de cada uma, não porque o
-- banco valida a sintaxe):
--   {{nome_cliente}}      -> fichas_caso.nome_cliente (ou clientes.nome via cliente_id)
--   {{numero_processo}}   -> prazos.numero_processo_cnj (0003) da ficha vinculada
--   {{area_direito}}      -> fichas_caso.area_direito
--   {{valor_causa}}       -> contratos_honorario.valor_total (0003) da ficha vinculada
--   {{data_hoje}}         -> gerada em runtime (não vem de tabela nenhuma)
-- Variável sem correspondência (typo, campo não cadastrado na ficha) fica
-- como placeholder literal no texto gerado — validação/aviso ao usuário é
-- responsabilidade da camada de aplicação (zod), não do banco.

-- Log de petições geradas: JUSTIFICADO (não é over-engineering) porque
-- resolve um problema real que `modelos.uso_count` (0001, um contador solto)
-- não resolve: auditoria jurídica de "qual documento foi gerado, a partir de
-- qual modelo, para qual caso, por quem e com quais dados foram substituídos
-- no momento" — relevante para due diligence e para depurar reclamação de
-- cliente sobre petição errada meses depois. Custo é baixo (1 insert por
-- geração, tabela pequena). NÃO duplica `conteudo` de `modelos` (isso seria
-- redundante e cresceria sem necessidade) nem guarda o arquivo final (isso é
-- responsabilidade de storage de arquivo, fora de escopo desta migration).
create table if not exists peticoes_geradas (
  id             uuid primary key default gen_random_uuid(),
  escritorio_id  uuid not null references escritorios(id) on delete cascade,
  modelo_id      uuid not null references modelos(id) on delete cascade,
  ficha_caso_id  uuid references fichas_caso(id) on delete set null,
  gerado_por     uuid references perfis(id) on delete set null,
  -- Snapshot das variáveis resolvidas no momento da geração (ex:
  -- {"nome_cliente": "João Silva", "valor_causa": "15000.00"}) — não o
  -- documento inteiro, só o que foi de fato substituído, útil pra auditar
  -- "o que a IA/mail-merge preencheu" sem duplicar o texto completo.
  variaveis_usadas jsonb not null default '{}'::jsonb,
  criado_em      timestamptz not null default now()
);
create index if not exists idx_peticoes_geradas_escritorio on peticoes_geradas(escritorio_id);
create index if not exists idx_peticoes_geradas_modelo on peticoes_geradas(modelo_id);
create index if not exists idx_peticoes_geradas_ficha on peticoes_geradas(ficha_caso_id);

alter table peticoes_geradas enable row level security;
create policy "peticoes_geradas_isolamento" on peticoes_geradas
  for all using (escritorio_id = escritorio_atual());

-- ── 3. Dashboard de inadimplência + export pro contador ─────────────────
-- NENHUM schema novo necessário. Mesmo raciocínio do "3." em 0008
-- (relatório de produtividade): é leitura agregada sobre dados que já
-- existem e já carregam tudo que o dashboard precisa:
--   - `parcelas_honorario.status` (0003, com valor 'atrasado' já mantido
--     por `sincronizarParcelasAtrasadas` em app/app/financeiro/actions.ts)
--     -> inadimplência é filtrar status = 'atrasado' (ou vencimento < hoje)
--   - `parcelas_honorario.valor`/`vencimento`/`pago_em` -> valores em aberto,
--     dias de atraso, valores recebidos no período
--   - `contratos_honorario.ficha_caso_id` -> liga cada parcela ao cliente/
--     caso de origem, para o dashboard mostrar "quem está devendo"
--   - `clientes.nome`/`email` (0001, + `cpf` de 0008) -> dado de identificação
--     do devedor no export pro contador
-- O EXPORT pro contador (CSV/planilha de parcelas vencidas/recebidas num
-- período) é uma query agregada + serialização na camada de aplicação, não
-- schema — não há necessidade de tabela de "exportações" ou snapshot: o
-- contador sempre quer o estado ATUAL das parcelas, não um histórico de
-- quando cada export foi gerado (diferente de `peticoes_geradas` acima, que
-- tem valor de auditoria jurídica; aqui não há esse mesmo requisito).
-- `idx_parcelas_honorario_vencimento` e `idx_parcelas_honorario_escritorio`
-- (já existentes, 0003) cobrem os filtros mais prováveis dessa agregação;
-- se o volume de parcelas por escritório crescer o suficiente para o
-- planner preferir Seq Scan mesmo com esses índices, um índice composto
-- `(escritorio_id, status, vencimento)` é candidato natural — não criado
-- agora por não haver ainda evidência de EXPLAIN ANALYZE de que é
-- necessário (ver regra de indexação do agente `database`: nunca indexar
-- "por precaução").
