-- "Caso Inteligente" (Fase 1) — memória incremental de IA (0028) também
-- precisa poder ser indexada no pgvector (lib/rag/indexacao-interna.ts,
-- reindexarMemoriaCaso) para entrar na busca por similaridade junto das
-- demais fontes internas do escritório. `escritorio_id` continua NOT NULL
-- para essa fonte (não é dado compartilhado entre tenants como
-- jurisprudência em 0008) — só o CHECK de fonte_tipo precisa mudar.
alter table embeddings_chunks drop constraint if exists embeddings_chunks_fonte_tipo_check;
alter table embeddings_chunks add constraint embeddings_chunks_fonte_tipo_check
  check (fonte_tipo in ('documento_upload', 'ficha_caso', 'prazo', 'modelo', 'jurisprudencia', 'memoria_ia_caso'));
