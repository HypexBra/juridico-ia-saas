const pool = require('./pool');

// ─── CLIENTES ─────────────────────────────────────────────────────────────────
async function upsertCliente(numero, nome = null, tipo = 'externo') {
  const { rows } = await pool.query(`
    INSERT INTO clientes (numero, nome, tipo, ultima_msg)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (numero) DO UPDATE
      SET ultima_msg = NOW(), nome = COALESCE($2, clientes.nome)
    RETURNING *`, [numero, nome, tipo]);
  return rows[0];
}

async function listarClientes() {
  const { rows } = await pool.query(`
    SELECT c.id, c.numero, c.nome, c.tipo, c.ultima_msg,
      COUNT(DISTINCT cv.id) AS total_conversas,
      COUNT(m.id)           AS total_mensagens
    FROM clientes c
    LEFT JOIN conversas cv ON cv.cliente_id = c.id
    LEFT JOIN mensagens m  ON m.cliente_id  = c.id
    GROUP BY c.id ORDER BY c.ultima_msg DESC`);
  return rows;
}

// ─── NÚMEROS AUTORIZADOS (advogados) ─────────────────────────────────────────
async function isAdvogado(numero) {
  const { rows } = await pool.query(
    `SELECT 1 FROM numeros_autorizados WHERE numero = $1`, [numero]);
  return rows.length > 0;
}

async function listarNumerosAutorizados() {
  const { rows } = await pool.query(
    `SELECT * FROM numeros_autorizados ORDER BY criado_em DESC`);
  return rows;
}

async function adicionarNumeroAutorizado(numero, nome) {
  await pool.query(
    `INSERT INTO numeros_autorizados (numero, nome) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [numero, nome]);
}

async function removerNumeroAutorizado(id) {
  await pool.query(`DELETE FROM numeros_autorizados WHERE id = $1`, [id]);
}

// ─── USUÁRIOS ─────────────────────────────────────────────────────────────────
async function criarUsuario(nome, email, senhaHash, role = 'advogado', numeroWhats = null) {
  const { rows } = await pool.query(`
    INSERT INTO usuarios (nome, email, senha_hash, role, numero_whats)
    VALUES ($1,$2,$3,$4,$5) RETURNING id, nome, email, role, ativo, criado_em`,
    [nome, email, senhaHash, role, numeroWhats]);
  return rows[0];
}

async function buscarUsuarioPorEmail(email) {
  const { rows } = await pool.query(
    `SELECT * FROM usuarios WHERE email=$1 AND ativo=TRUE`, [email]);
  return rows[0] || null;
}

async function listarUsuarios() {
  const { rows } = await pool.query(
    `SELECT id, nome, email, role, numero_whats, ativo, criado_em, ultimo_login
     FROM usuarios ORDER BY criado_em DESC`);
  return rows;
}

async function getAdminNumeros() {
  const { rows } = await pool.query(
    `SELECT numero_whats FROM usuarios WHERE numero_whats IS NOT NULL AND ativo=TRUE`);
  return rows.map(r => r.numero_whats).filter(Boolean);
}

async function atualizarLogin(id) {
  await pool.query(`UPDATE usuarios SET ultimo_login=NOW() WHERE id=$1`, [id]);
}

async function toggleUsuario(id) {
  await pool.query(`UPDATE usuarios SET ativo = NOT ativo WHERE id=$1`, [id]);
}

async function deletarUsuario(id) {
  await pool.query(`DELETE FROM usuarios WHERE id=$1`, [id]);
}

async function atualizarSenha(id, senhaHash) {
  await pool.query(`UPDATE usuarios SET senha_hash=$1 WHERE id=$2`, [senhaHash, id]);
}

// ─── TAGS ─────────────────────────────────────────────────────────────────────
async function listarTags() {
  const { rows } = await pool.query(`SELECT * FROM tags ORDER BY nome`);
  return rows;
}

async function adicionarTagConversa(conversaId, tagId) {
  await pool.query(
    `INSERT INTO conversas_tags (conversa_id, tag_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [conversaId, tagId]);
}

async function removerTagConversa(conversaId, tagId) {
  await pool.query(
    `DELETE FROM conversas_tags WHERE conversa_id=$1 AND tag_id=$2`,
    [conversaId, tagId]);
}

async function getTagsConversa(conversaId) {
  const { rows } = await pool.query(`
    SELECT t.* FROM tags t
    JOIN conversas_tags ct ON ct.tag_id = t.id
    WHERE ct.conversa_id = $1`, [conversaId]);
  return rows;
}

// ─── CONVERSAS ────────────────────────────────────────────────────────────────
async function criarConversa(clienteId, tipo = 'interno') {
  const { rows } = await pool.query(
    `INSERT INTO conversas (cliente_id, tipo) VALUES ($1,$2) RETURNING *`,
    [clienteId, tipo]);
  return rows[0];
}

async function encerrarConversa(conversaId) {
  await pool.query(
    `UPDATE conversas SET encerrada_em=NOW(), status='encerrada' WHERE id=$1`,
    [conversaId]);
}

async function atualizarStatusConversa(conversaId, status) {
  await pool.query(`UPDATE conversas SET status=$1 WHERE id=$2`, [status, conversaId]);
}

async function getConversaAtiva(clienteId) {
  const { rows } = await pool.query(`
    SELECT * FROM conversas
    WHERE cliente_id=$1 AND status NOT IN ('encerrada')
      AND iniciada_em > NOW() - INTERVAL '24 hours'
    ORDER BY iniciada_em DESC LIMIT 1`, [clienteId]);
  return rows[0] || null;
}

async function listarConversas(filtros = {}) {
  const { tagId, numero, tipo, limite = 50, pagina = 0 } = filtros;
  const params = [];
  const where  = [];

  if (numero) { params.push(`%${numero}%`); where.push(`cl.numero ILIKE $${params.length}`); }
  if (tagId)  { params.push(tagId); where.push(`EXISTS (SELECT 1 FROM conversas_tags ct WHERE ct.conversa_id=cv.id AND ct.tag_id=$${params.length})`); }
  if (tipo)   { params.push(tipo); where.push(`cv.tipo=$${params.length}`); }

  const cond = where.length ? 'WHERE ' + where.join(' AND ') : '';
  params.push(limite, pagina * limite);

  const { rows } = await pool.query(`
    SELECT cv.id, cv.iniciada_em, cv.encerrada_em, cv.total_msgs, cv.tipo, cv.status,
           cl.numero, cl.nome, cl.tipo AS cliente_tipo,
           COALESCE(json_agg(json_build_object('id',t.id,'nome',t.nome,'cor',t.cor))
             FILTER (WHERE t.id IS NOT NULL), '[]') AS tags
    FROM conversas cv
    JOIN clientes cl ON cl.id = cv.cliente_id
    LEFT JOIN conversas_tags ct2 ON ct2.conversa_id = cv.id
    LEFT JOIN tags t ON t.id = ct2.tag_id
    ${cond}
    GROUP BY cv.id, cl.numero, cl.nome, cl.tipo
    ORDER BY cv.iniciada_em DESC
    LIMIT $${params.length-1} OFFSET $${params.length}`, params);
  return rows;
}

// ─── MENSAGENS ────────────────────────────────────────────────────────────────
async function salvarMensagem(conversaId, clienteId, role, conteudo, tokensUsados = 0, tipo = 'text', arquivoNome = null) {
  await pool.query(`
    INSERT INTO mensagens (conversa_id, cliente_id, role, conteudo, tokens_usados, tipo, arquivo_nome)
    VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [conversaId, clienteId, role, conteudo, tokensUsados, tipo, arquivoNome]);
  await pool.query(`UPDATE conversas SET total_msgs=total_msgs+1 WHERE id=$1`, [conversaId]);
}

async function getHistoricoConversa(conversaId) {
  const { rows } = await pool.query(`
    SELECT role, conteudo AS content FROM mensagens
    WHERE conversa_id=$1 ORDER BY criado_em ASC`, [conversaId]);
  return rows.map(r => ({ role: r.role, content: r.content }));
}

async function getMensagensConversa(conversaId) {
  const { rows } = await pool.query(`
    SELECT id, role, conteudo, tokens_usados, tipo, arquivo_nome, criado_em
    FROM mensagens WHERE conversa_id=$1 ORDER BY criado_em ASC`, [conversaId]);
  return rows;
}

// ─── FICHAS DE CASO ───────────────────────────────────────────────────────────
async function salvarFichaCaso(dados) {
  const { rows } = await pool.query(`
    INSERT INTO fichas_caso
      (conversa_id, cliente_id, nome_cliente, telefone, area_direito,
       resumo_fatos, documentos, urgencia, resumo_ia, questoes_ia, estrategia_ia, documentos_ia)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    ON CONFLICT (conversa_id) DO UPDATE SET
      resumo_ia=$9, questoes_ia=$10, estrategia_ia=$11, documentos_ia=$12
    RETURNING *`,
    [dados.conversaId, dados.clienteId, dados.nomeCliente, dados.telefone,
     dados.areaDireito, dados.resumoFatos, dados.documentos, dados.urgencia,
     dados.resumoIa, dados.questoesIa, dados.estrategiaIa, dados.documentosIa]);
  return rows[0];
}

async function listarFichas(apenasNaoLidas = false) {
  const where = apenasNaoLidas ? 'WHERE f.lida=FALSE' : '';
  const { rows } = await pool.query(`
    SELECT f.*, cl.numero, cl.nome AS nome_whats
    FROM fichas_caso f
    JOIN clientes cl ON cl.id = f.cliente_id
    ${where}
    ORDER BY f.criado_em DESC`);
  return rows;
}

async function getFicha(conversaId) {
  const { rows } = await pool.query(`
    SELECT f.*, cl.numero FROM fichas_caso f
    JOIN clientes cl ON cl.id = f.cliente_id
    WHERE f.conversa_id=$1`, [conversaId]);
  return rows[0] || null;
}

async function marcarFichaLida(conversaId) {
  await pool.query(`UPDATE fichas_caso SET lida=TRUE WHERE conversa_id=$1`, [conversaId]);
}

async function contarFichasNaoLidas() {
  const { rows } = await pool.query(`SELECT COUNT(*) AS total FROM fichas_caso WHERE lida=FALSE`);
  return parseInt(rows[0].total);
}

// ─── ESTATÍSTICAS ─────────────────────────────────────────────────────────────
async function getEstatisticas() {
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM clientes)                              AS total_clientes,
      (SELECT COUNT(*) FROM clientes WHERE tipo='externo')         AS clientes_externos,
      (SELECT COUNT(*) FROM conversas)                            AS total_conversas,
      (SELECT COUNT(*) FROM conversas WHERE tipo='triagem')       AS triagens,
      (SELECT COUNT(*) FROM mensagens)                            AS total_mensagens,
      (SELECT COUNT(*) FROM mensagens WHERE role='user')          AS msgs_clientes,
      (SELECT COUNT(*) FROM mensagens WHERE role='assistant')     AS msgs_ia,
      (SELECT COUNT(*) FROM conversas WHERE iniciada_em > NOW() - INTERVAL '7 days') AS conversas_semana,
      (SELECT COALESCE(SUM(tokens_usados),0) FROM mensagens WHERE role='assistant')  AS total_tokens,
      (SELECT COUNT(*) FROM fichas_caso WHERE lida=FALSE)         AS fichas_nao_lidas,
      (SELECT COUNT(*) FROM usuarios WHERE ativo=TRUE)            AS usuarios_ativos`);
  return rows[0];
}

async function buscarMensagens(termo) {
  const { rows } = await pool.query(`
    SELECT m.id, m.role, m.conteudo, m.criado_em, cl.numero, cl.nome, m.conversa_id
    FROM mensagens m JOIN clientes cl ON cl.id = m.cliente_id
    WHERE m.conteudo ILIKE $1 ORDER BY m.criado_em DESC LIMIT 50`, [`%${termo}%`]);
  return rows;
}

module.exports = {
  upsertCliente, listarClientes,
  isAdvogado, listarNumerosAutorizados, adicionarNumeroAutorizado, removerNumeroAutorizado,
  criarUsuario, buscarUsuarioPorEmail, listarUsuarios, getAdminNumeros,
  atualizarLogin, toggleUsuario, deletarUsuario, atualizarSenha,
  listarTags, adicionarTagConversa, removerTagConversa, getTagsConversa,
  criarConversa, encerrarConversa, atualizarStatusConversa, getConversaAtiva, listarConversas,
  salvarMensagem, getHistoricoConversa, getMensagensConversa,
  salvarFichaCaso, listarFichas, getFicha, marcarFichaLida, contarFichasNaoLidas,
  getEstatisticas, buscarMensagens
};
