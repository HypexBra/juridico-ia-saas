const pool = require('./db/pool');

// Custo aproximado por token (claude-sonnet-4-6)
const CUSTO_INPUT_POR_TOKEN  = 0.000003;  // US$ 3 por 1M tokens input
const CUSTO_OUTPUT_POR_TOKEN = 0.000015;  // US$ 15 por 1M tokens output

async function registrarCusto(conversaId, clienteId, tokensIn, tokensOut) {
  const custo = (tokensIn * CUSTO_INPUT_POR_TOKEN) + (tokensOut * CUSTO_OUTPUT_POR_TOKEN);
  const mesRef = new Date().toISOString().substring(0, 7); // "2025-07"
  await pool.query(`
    INSERT INTO custos (conversa_id, cliente_id, tokens_in, tokens_out, custo_usd, mes_ref)
    VALUES ($1,$2,$3,$4,$5,$6)`,
    [conversaId, clienteId, tokensIn, tokensOut, custo.toFixed(6), mesRef]);
  return custo;
}

async function getDashboardFinanceiro() {
  const { rows } = await pool.query(`
    SELECT
      mes_ref,
      COUNT(DISTINCT conversa_id)    AS total_conversas,
      COUNT(DISTINCT cliente_id)     AS total_clientes,
      SUM(tokens_in)                 AS tokens_in,
      SUM(tokens_out)                AS tokens_out,
      SUM(tokens_in + tokens_out)    AS tokens_total,
      SUM(custo_usd)                 AS custo_usd
    FROM custos
    GROUP BY mes_ref
    ORDER BY mes_ref DESC
    LIMIT 12`);
  return rows;
}

async function getCustoPorArea() {
  const { rows } = await pool.query(`
    SELECT
      COALESCE(f.area_direito, 'Interno') AS area,
      COUNT(DISTINCT cu.conversa_id)       AS conversas,
      SUM(cu.custo_usd)                    AS custo_usd,
      SUM(cu.tokens_in + cu.tokens_out)    AS tokens
    FROM custos cu
    LEFT JOIN fichas_caso f ON f.conversa_id = cu.conversa_id
    GROUP BY area ORDER BY custo_usd DESC`);
  return rows;
}

async function getCustoPorCliente(limite = 10) {
  const { rows } = await pool.query(`
    SELECT
      cl.numero, cl.nome, cl.tipo,
      COUNT(DISTINCT cu.conversa_id) AS conversas,
      SUM(cu.custo_usd)              AS custo_usd,
      SUM(cu.tokens_in + cu.tokens_out) AS tokens
    FROM custos cu
    JOIN clientes cl ON cl.id = cu.cliente_id
    GROUP BY cl.id ORDER BY custo_usd DESC
    LIMIT $1`, [limite]);
  return rows;
}

async function getProjecaoMes() {
  const mesAtual = new Date().toISOString().substring(0, 7);
  const diaAtual = new Date().getDate();
  const diasMes  = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();

  const { rows } = await pool.query(`
    SELECT COALESCE(SUM(custo_usd), 0) AS gasto_ate_agora
    FROM custos WHERE mes_ref = $1`, [mesAtual]);

  const gastoAteAgora = parseFloat(rows[0].gasto_ate_agora);
  const projecao = (gastoAteAgora / diaAtual) * diasMes;

  return {
    mesAtual,
    gastoAteAgora: gastoAteAgora.toFixed(4),
    projecaoMes: projecao.toFixed(4),
    diaAtual,
    diasMes,
    percentualMes: Math.round((diaAtual / diasMes) * 100)
  };
}

module.exports = { registrarCusto, getDashboardFinanceiro, getCustoPorArea, getCustoPorCliente, getProjecaoMes, CUSTO_INPUT_POR_TOKEN, CUSTO_OUTPUT_POR_TOKEN };
