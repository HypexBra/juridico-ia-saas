-- Estrategista Jurídico (Fase 6) — a IA sintetiza tudo que já existe sobre um
-- caso (`fichas_caso`) já aberto (teses, eventos, pessoas, jurisprudência
-- citada, análises de documento/processo) e produz objetivo, tese principal,
-- teses subsidiárias, provas necessárias/disponíveis, riscos, oportunidades,
-- próximos passos e ações recomendadas. Primeiro "agregador" do produto —
-- diferente das 5 features anteriores (one-shot sobre um texto avulso), aqui
-- não há texto novo do usuário, só leitura de dado já estruturado. Cada
-- geração é uma linha nova, nunca um UPDATE de uma linha "corrente" (mesmo
-- racional de `analises_documento`/`auditorias_peca`/
-- `analises_advogado_contra`), reforçado aqui porque a ENTRADA (o estado do
-- caso) muda com o tempo por natureza. Ver docs/adrs/0014-estrategista-caso.md.
--
-- `ficha_caso_id` NOT NULL — única tabela de resultado de IA do projeto com
-- essa obrigatoriedade (todas as anteriores usam nullable para permitir uso
-- standalone): o Estrategista não faz sentido sem um caso já aberto (ADR
-- 0014, seções 1 e 6).
--
-- `contexto_resumo` (jsonb leve: ids/contadores das fontes lidas, não o
-- conteúdo integral) permite à UI mostrar "gerado com base em: N teses, N
-- eventos, ..." sem re-consultar todas as tabelas de origem, e deixa a porta
-- aberta para uma heurística futura de "estratégia desatualizada" sem
-- migração nova.
create table if not exists estrategias_caso (
  id                    uuid primary key default gen_random_uuid(),
  escritorio_id         uuid not null references escritorios(id) on delete cascade,
  ficha_caso_id         uuid not null references fichas_caso(id) on delete cascade,
  status                varchar(20) not null default 'processando'
                          check (status in ('processando', 'pronto', 'erro')),
  -- Estrutura de `ResultadoEstrategiaCaso` (`lib/estrategia-caso/tipos.ts`,
  -- próxima onda). `null` enquanto `status = 'processando'`.
  resultado_estrategia  jsonb,
  -- Snapshot do QUE foi lido para gerar (contadores/ids das 6 fontes) — ver
  -- ADR 0014, seção 1.
  contexto_resumo       jsonb,
  modelo_ia_usado       varchar(50),
  erro                  text,
  criado_por            uuid references perfis(id) on delete set null,
  criado_em             timestamptz not null default now(),
  processado_em         timestamptz
);
create index if not exists idx_estrategias_caso_escritorio on estrategias_caso(escritorio_id);
-- Índice composto (não o padrão simples de índice único por coluna usado nas
-- tabelas anteriores) porque a query mais comum é "última estratégia gerada
-- para esta ficha" — ADR 0014, seção 1.
create index if not exists idx_estrategias_caso_ficha_criado on estrategias_caso(ficha_caso_id, criado_em desc);

alter table estrategias_caso enable row level security;
create policy "estrategias_caso_isolamento" on estrategias_caso
  for all using (escritorio_id = escritorio_atual());
