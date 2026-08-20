-- "Caso Inteligente" (Fase 2) — análise inteligente de um documento do
-- processo (PDF/DOCX/imagem) vinculado a uma `ficha_caso`. A IA lê o
-- documento inteiro em UMA chamada (sem chunking/RAG — ver
-- docs/adrs/0004-analise-inteligente-processos.md) e devolve 12 seções
-- estruturadas dentro de `resultado_analise`. Distinta de
-- `analises_risco_contratual` (migration 0017, que analisa CONTRATO
-- cláusula por cláusula): aqui o insumo é qualquer documento do processo e
-- a saída cobre linha do tempo, partes, teses, riscos, prazos etc.
--
-- Sem tabela de "trechos-fonte" normalizada (ver ADR 0004, seção 1):
-- cada afirmação da IA já embute `trechoOriginal`/`pagina`/`certeza` no
-- próprio item do JSON — mesmo padrão de `ClausulaAnalisada.trechoOriginal`
-- do redline (`lib/redline/tipos.ts`).
create table if not exists analises_processo (
  id                uuid primary key default gen_random_uuid(),
  escritorio_id     uuid not null references escritorios(id) on delete cascade,
  ficha_caso_id     uuid not null references fichas_caso(id) on delete cascade,
  nome_arquivo      varchar(255) not null,
  tipo_arquivo      varchar(10) not null check (tipo_arquivo in ('pdf', 'docx', 'imagem')),
  tamanho_bytes     integer not null,
  status            varchar(20) not null default 'processando'
                      check (status in ('processando', 'pronto', 'erro')),
  -- Estrutura de `ResultadoAnaliseProcesso` (`lib/analise-processo/tipos.ts`)
  -- — as 12 seções da análise. `null` enquanto `status = 'processando'`.
  resultado_analise jsonb,
  modelo_ia_usado   varchar(50),
  erro              text,
  criado_por        uuid references perfis(id) on delete set null,
  criado_em         timestamptz not null default now(),
  processado_em     timestamptz
);
create index if not exists idx_analises_processo_escritorio on analises_processo(escritorio_id);
create index if not exists idx_analises_processo_ficha on analises_processo(ficha_caso_id);

alter table analises_processo enable row level security;
create policy "analises_processo_isolamento" on analises_processo
  for all using (escritorio_id = escritorio_atual());
