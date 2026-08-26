-- Habilita a extensão de busca vetorial no Postgres (rodar uma vez só)
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabela que guarda cada trecho de conteúdo jurídico já processado,
-- junto com seu vetor (embedding) e metadados de origem.
CREATE TABLE IF NOT EXISTS base_juridica (
  id BIGSERIAL PRIMARY KEY,
  fonte TEXT NOT NULL,              -- ex: 'djen', 'stj', 'stf', 'planalto'
  tipo TEXT NOT NULL,               -- ex: 'jurisprudencia', 'sumula', 'lei', 'movimentacao'
  titulo TEXT,
  conteudo TEXT NOT NULL,           -- o trecho (chunk) de texto em si
  hash_conteudo TEXT NOT NULL UNIQUE, -- sha256 do chunk, evita indexar o mesmo trecho duas vezes
  url_original TEXT,
  tribunal_vara TEXT,               -- quando aplicável (ex: '2ª Vara Cível de SP')
  relator TEXT,                     -- quando aplicável, para os módulos P2.1/P2.2
  data_publicacao DATE,
  embedding VECTOR(1536),           -- 1536 = dimensão do text-embedding-3-small (OpenAI)
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para a checagem de duplicidade no job diário ser rápida em escala
CREATE INDEX IF NOT EXISTS base_juridica_hash_idx ON base_juridica (hash_conteudo);

-- Índice para busca por similaridade rápida (aproximada, mas muito mais rápida em escala)
-- Nota operacional: ivfflat calibra melhor com dados já presentes na tabela.
-- Criado aqui vazio para já existir desde o início, mas depois que a base
-- tiver um volume razoável (milhares de linhas), vale rodar
-- REINDEX INDEX base_juridica_embedding_idx; uma vez para recalibrar.
CREATE INDEX IF NOT EXISTS base_juridica_embedding_idx
  ON base_juridica USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Índice auxiliar para o job diário saber o que já buscou por fonte
CREATE INDEX IF NOT EXISTS base_juridica_fonte_data_idx
  ON base_juridica (fonte, data_publicacao DESC);

-- Checkpoint de execução por fonte, com timestamp completo (não só data).
-- Isso é o que garante a busca incremental correta mesmo que o job rode
-- mais de uma vez no mesmo dia (ex: se o schedule mudar para a cada 6h) —
-- usar apenas data_publicacao (tipo DATE) perderia a granularidade de hora
-- e poderia pular conteúdo publicado entre duas execuções do mesmo dia.
CREATE TABLE IF NOT EXISTS rag_fonte_cursor (
  fonte TEXT PRIMARY KEY,
  ultima_busca_em TIMESTAMPTZ NOT NULL
);

-- Tabela de auditoria do job diário — atende ao critério de aceite do P0.4
-- (log de execução, sucesso/falha, alerta se parar de rodar)
CREATE TABLE IF NOT EXISTS rag_execucao_log (
  id BIGSERIAL PRIMARY KEY,
  executado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  fonte TEXT NOT NULL,
  status TEXT NOT NULL,             -- 'sucesso' | 'sucesso_parcial' | 'erro'
  documentos_novos INT DEFAULT 0,
  mensagem_erro TEXT
);
