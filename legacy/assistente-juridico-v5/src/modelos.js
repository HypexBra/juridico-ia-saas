const pool = require('./db/pool');

async function listarModelos(area = null) {
  const where = area ? `WHERE area = $1` : '';
  const params = area ? [area] : [];
  const { rows } = await pool.query(`
    SELECT m.*, u.nome AS criado_por_nome
    FROM modelos m LEFT JOIN usuarios u ON u.id = m.criado_por
    ${where} ORDER BY uso_count DESC, nome ASC`, params);
  return rows;
}

async function getModelo(id) {
  const { rows } = await pool.query(`SELECT * FROM modelos WHERE id=$1`, [id]);
  return rows[0] || null;
}

async function criarModelo(dados) {
  const { rows } = await pool.query(`
    INSERT INTO modelos (nome, area, tipo, descricao, conteudo, criado_por)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [dados.nome, dados.area, dados.tipo, dados.descricao, dados.conteudo, dados.criadoPor]);
  return rows[0];
}

async function atualizarModelo(id, dados) {
  await pool.query(`
    UPDATE modelos SET nome=$1, area=$2, tipo=$3, descricao=$4, conteudo=$5, atualizado=NOW()
    WHERE id=$6`, [dados.nome, dados.area, dados.tipo, dados.descricao, dados.conteudo, id]);
}

async function deletarModelo(id) {
  await pool.query(`DELETE FROM modelos WHERE id=$1`, [id]);
}

async function incrementarUso(id) {
  await pool.query(`UPDATE modelos SET uso_count=uso_count+1 WHERE id=$1`, [id]);
}

async function getAreasDisponiveis() {
  const { rows } = await pool.query(`SELECT DISTINCT area FROM modelos WHERE area IS NOT NULL ORDER BY area`);
  return rows.map(r => r.area);
}

module.exports = { listarModelos, getModelo, criarModelo, atualizarModelo, deletarModelo, incrementarUso, getAreasDisponiveis };
