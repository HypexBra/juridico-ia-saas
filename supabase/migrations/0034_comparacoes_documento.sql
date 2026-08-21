-- Document Intelligence (Fase 3) — comparador de documentos (Contrato A x
-- Contrato B): cláusulas adicionadas/removidas/alteradas, riscos,
-- recomendações. Entidade própria (relaciona 2 documentos, produz 1 diff
-- estruturado) — não cabe como linha de `analises_documento` (cardinalidade
-- 1 análise = 1 documento) nem como tabela de associação genérica sem
-- coluna de resultado própria. Ver docs/adrs/0011-document-intelligence.md,
-- seção 2.
create table if not exists comparacoes_documento (
  id                     uuid primary key default gen_random_uuid(),
  escritorio_id          uuid not null references escritorios(id) on delete cascade,
  ficha_caso_id          uuid references fichas_caso(id) on delete set null,
  nome_arquivo_a         varchar(255) not null,
  nome_arquivo_b         varchar(255) not null,
  -- Link opcional para uma análise individual pré-existente de cada lado
  -- (ex.: usuário abre a comparação a partir da tela de uma análise já
  -- feita) — nullable porque a comparação também aceita 2 uploads novos,
  -- sem exigir análise individual prévia de cada documento.
  analise_documento_a_id uuid references analises_documento(id) on delete set null,
  analise_documento_b_id uuid references analises_documento(id) on delete set null,
  status                 varchar(20) not null default 'processando'
                           check (status in ('processando', 'pronto', 'erro')),
  -- Estrutura de `ResultadoComparacaoDocumento`
  -- (`lib/document-intelligence/tipos.ts`, Onda 1). `null` enquanto
  -- `status = 'processando'`.
  resultado_comparacao  jsonb,
  modelo_ia_usado        varchar(50),
  erro                   text,
  criado_por             uuid references perfis(id) on delete set null,
  criado_em              timestamptz not null default now(),
  processado_em          timestamptz
);
create index if not exists idx_comparacoes_documento_escritorio on comparacoes_documento(escritorio_id);
create index if not exists idx_comparacoes_documento_ficha on comparacoes_documento(ficha_caso_id);
create index if not exists idx_comparacoes_documento_analise_a on comparacoes_documento(analise_documento_a_id);
create index if not exists idx_comparacoes_documento_analise_b on comparacoes_documento(analise_documento_b_id);

alter table comparacoes_documento enable row level security;
create policy "comparacoes_documento_isolamento" on comparacoes_documento
  for all using (escritorio_id = escritorio_atual());
