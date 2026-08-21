-- Document Intelligence (Fase 3) — análise individual/em lote de UM
-- documento avulso (PDF/DOCX/imagem), não necessariamente vinculado a uma
-- `ficha_caso` aberta. Distinta de `analises_processo` (migration 0030, que
-- é 1:1 com narrativa de CASO inteiro, `ficha_caso_id NOT NULL`) e de
-- `analises_risco_contratual` (migration 0017, escopo fechado em contratos
-- colados como texto, sem upload/extração/classificação de tipo). Ver
-- docs/adrs/0011-document-intelligence.md, seção 1.
--
-- `ficha_caso_id` nullable segue o precedente de `analises_risco_contratual`
-- (0017): documento avulso é o caso comum (due diligence, triagem antes de
-- abrir ficha), vínculo com ficha é conveniência opcional.
create table if not exists analises_documento (
  id                uuid primary key default gen_random_uuid(),
  escritorio_id     uuid not null references escritorios(id) on delete cascade,
  ficha_caso_id     uuid references fichas_caso(id) on delete set null,
  nome_arquivo      varchar(255) not null,
  tipo_arquivo      varchar(10) not null check (tipo_arquivo in ('pdf', 'docx', 'imagem')),
  tamanho_bytes     integer not null,
  status            varchar(20) not null default 'processando'
                      check (status in ('processando', 'pronto', 'erro')),
  -- Estrutura de `ResultadoAnaliseDocumento`
  -- (`lib/document-intelligence/tipos.ts`, Onda 1). `null` enquanto
  -- `status = 'processando'`.
  resultado_analise jsonb,
  modelo_ia_usado   varchar(50),
  erro              text,
  criado_por        uuid references perfis(id) on delete set null,
  criado_em         timestamptz not null default now(),
  processado_em     timestamptz
);
create index if not exists idx_analises_documento_escritorio on analises_documento(escritorio_id);
create index if not exists idx_analises_documento_ficha on analises_documento(ficha_caso_id);

alter table analises_documento enable row level security;
create policy "analises_documento_isolamento" on analises_documento
  for all using (escritorio_id = escritorio_atual());
