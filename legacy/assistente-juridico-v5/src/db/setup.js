require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function setupBanco() {
  const client = await pool.connect();
  try {
    console.log('🔧 Criando/atualizando tabelas...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS clientes (
        id         SERIAL PRIMARY KEY,
        numero     VARCHAR(20) UNIQUE NOT NULL,
        nome       VARCHAR(255),
        tipo       VARCHAR(20) DEFAULT 'externo' CHECK (tipo IN ('advogado','externo')),
        criado_em  TIMESTAMP DEFAULT NOW(),
        ultima_msg TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS usuarios (
        id           SERIAL PRIMARY KEY,
        nome         VARCHAR(255) NOT NULL,
        email        VARCHAR(255) UNIQUE NOT NULL,
        senha_hash   VARCHAR(255) NOT NULL,
        role         VARCHAR(20) DEFAULT 'advogado' CHECK (role IN ('admin','advogado')),
        numero_whats VARCHAR(20),
        ativo        BOOLEAN DEFAULT TRUE,
        criado_em    TIMESTAMP DEFAULT NOW(),
        ultimo_login TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS numeros_autorizados (
        id        SERIAL PRIMARY KEY,
        numero    VARCHAR(20) UNIQUE NOT NULL,
        nome      VARCHAR(255),
        criado_em TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS tags (
        id   SERIAL PRIMARY KEY,
        nome VARCHAR(50) UNIQUE NOT NULL,
        cor  VARCHAR(7) DEFAULT '#6366f1'
      );

      CREATE TABLE IF NOT EXISTS conversas (
        id           SERIAL PRIMARY KEY,
        cliente_id   INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
        tipo         VARCHAR(20) DEFAULT 'interno' CHECK (tipo IN ('interno','triagem')),
        status       VARCHAR(20) DEFAULT 'ativa' CHECK (status IN ('ativa','triagem_completa','encerrada')),
        iniciada_em  TIMESTAMP DEFAULT NOW(),
        encerrada_em TIMESTAMP,
        total_msgs   INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS fichas_caso (
        id            SERIAL PRIMARY KEY,
        conversa_id   INTEGER REFERENCES conversas(id) ON DELETE CASCADE,
        cliente_id    INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
        nome_cliente  VARCHAR(255),
        telefone      VARCHAR(20),
        area_direito  VARCHAR(100),
        resumo_fatos  TEXT,
        documentos    TEXT,
        urgencia      VARCHAR(20) DEFAULT 'normal',
        resumo_ia     TEXT,
        questoes_ia   TEXT,
        estrategia_ia TEXT,
        documentos_ia TEXT,
        lida          BOOLEAN DEFAULT FALSE,
        criado_em     TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS conversas_tags (
        conversa_id INTEGER REFERENCES conversas(id) ON DELETE CASCADE,
        tag_id      INTEGER REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (conversa_id, tag_id)
      );

      CREATE TABLE IF NOT EXISTS mensagens (
        id            SERIAL PRIMARY KEY,
        conversa_id   INTEGER REFERENCES conversas(id) ON DELETE CASCADE,
        cliente_id    INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
        role          VARCHAR(10) NOT NULL CHECK (role IN ('user','assistant')),
        conteudo      TEXT NOT NULL,
        tipo          VARCHAR(20) DEFAULT 'text',
        arquivo_nome  VARCHAR(255),
        tokens_usados INTEGER DEFAULT 0,
        criado_em     TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_mensagens_conversa   ON mensagens(conversa_id);
      CREATE INDEX IF NOT EXISTS idx_conversas_cliente    ON conversas(cliente_id);
      CREATE INDEX IF NOT EXISTS idx_fichas_conversa      ON fichas_caso(conversa_id);
      CREATE INDEX IF NOT EXISTS idx_fichas_lida          ON fichas_caso(lida);
      CREATE INDEX IF NOT EXISTS idx_numeros_autorizados  ON numeros_autorizados(numero);

      INSERT INTO tags (nome, cor) VALUES
        ('Trabalhista','#3b82f6'),('Cível','#8b5cf6'),('Penal','#ef4444'),
        ('Tributário','#f59e0b'),('Consumidor','#10b981'),('Família','#ec4899'),
        ('Empresarial','#6366f1'),('Previdenciário','#14b8a6'),
        ('Administrativo','#f97316'),('LGPD','#64748b'),('Urgente','#dc2626')
      ON CONFLICT (nome) DO NOTHING;
    `);
    console.log('✅ Banco configurado com sucesso!');
  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}
setupBanco();

// EXTENSÃO v5 — rode novamente se já tinha o banco da v4
async function setupV5(client) {
  await client.query(`
    -- Prazos processuais
    CREATE TABLE IF NOT EXISTS prazos (
      id           SERIAL PRIMARY KEY,
      usuario_id   INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
      titulo       VARCHAR(255) NOT NULL,
      descricao    TEXT,
      data_prazo   DATE NOT NULL,
      processo     VARCHAR(100),
      cliente_nome VARCHAR(255),
      lembrete_7   BOOLEAN DEFAULT FALSE,
      lembrete_3   BOOLEAN DEFAULT FALSE,
      lembrete_1   BOOLEAN DEFAULT FALSE,
      concluido    BOOLEAN DEFAULT FALSE,
      criado_em    TIMESTAMP DEFAULT NOW()
    );

    -- Biblioteca de modelos (templates de peças)
    CREATE TABLE IF NOT EXISTS modelos (
      id          SERIAL PRIMARY KEY,
      nome        VARCHAR(255) NOT NULL,
      area        VARCHAR(100),
      tipo        VARCHAR(100),
      descricao   TEXT,
      conteudo    TEXT NOT NULL,
      uso_count   INTEGER DEFAULT 0,
      criado_por  INTEGER REFERENCES usuarios(id),
      criado_em   TIMESTAMP DEFAULT NOW(),
      atualizado  TIMESTAMP DEFAULT NOW()
    );

    -- Custo financeiro por conversa
    CREATE TABLE IF NOT EXISTS custos (
      id          SERIAL PRIMARY KEY,
      conversa_id INTEGER REFERENCES conversas(id) ON DELETE CASCADE,
      cliente_id  INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
      tokens_in   INTEGER DEFAULT 0,
      tokens_out  INTEGER DEFAULT 0,
      custo_usd   NUMERIC(10,6) DEFAULT 0,
      mes_ref     VARCHAR(7),
      criado_em   TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_prazos_data     ON prazos(data_prazo);
    CREATE INDEX IF NOT EXISTS idx_prazos_usuario  ON prazos(usuario_id);
    CREATE INDEX IF NOT EXISTS idx_custos_mes      ON custos(mes_ref);
    CREATE INDEX IF NOT EXISTS idx_modelos_area    ON modelos(area);
  `);
  console.log('✅ Tabelas v5 criadas!');
}
