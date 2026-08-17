const cron = require('node-cron');
const pool = require('./db/pool');
const { enviarMensagem } = require('./whatsapp');

// Resumo diário enviado às 07:30
async function enviarResumoDiario() {
  try {
    const hoje = new Date().toLocaleDateString('pt-BR');

    // Busca stats do dia
    const { rows: stats } = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM conversas WHERE iniciada_em::date = CURRENT_DATE)  AS conversas_hoje,
        (SELECT COUNT(*) FROM fichas_caso WHERE criado_em::date = CURRENT_DATE)  AS triagens_hoje,
        (SELECT COUNT(*) FROM fichas_caso WHERE lida = FALSE)                    AS fichas_pendentes,
        (SELECT COUNT(*) FROM prazos
          WHERE data_prazo BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
            AND concluido = FALSE)                                               AS prazos_semana,
        (SELECT COUNT(*) FROM prazos
          WHERE data_prazo = CURRENT_DATE AND concluido = FALSE)                 AS prazos_hoje
    `);
    const s = stats[0];

    // Busca prazos da semana
    const { rows: prazos } = await pool.query(`
      SELECT titulo, data_prazo, cliente_nome
      FROM prazos
      WHERE data_prazo BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
        AND concluido = FALSE
      ORDER BY data_prazo ASC LIMIT 5`);

    const prazosTexto = prazos.map(p =>
      `• ${p.titulo}${p.cliente_nome?' ('+p.cliente_nome+')':''} — ${new Date(p.data_prazo).toLocaleDateString('pt-BR')}`
    ).join('\n');

    const msg = `☀️ *BOM DIA — RESUMO ${hoje}*

📊 *Ontem / Esta semana:*
• ${s.conversas_hoje} conversa(s) hoje
• ${s.triagens_hoje} triagem(s) de cliente
• ${s.fichas_pendentes} ficha(s) pendente(s) de análise

⏰ *Prazos (próximos 7 dias):*
${prazos.length ? prazosTexto : 'Nenhum prazo nos próximos 7 dias ✅'}

${s.prazos_hoje > 0 ? `🔴 *ATENÇÃO: ${s.prazos_hoje} prazo(s) HOJE!*` : ''}

_Acesse o painel para mais detalhes._`;

    // Envia para todos os advogados com WhatsApp cadastrado
    const { rows: usuarios } = await pool.query(
      `SELECT numero_whats FROM usuarios WHERE numero_whats IS NOT NULL AND ativo=TRUE`);

    for (const u of usuarios) {
      try { await enviarMensagem(u.numero_whats, msg); } catch {}
    }

    console.log(`📨 Resumo diário enviado para ${usuarios.length} usuário(s)`);
  } catch (err) {
    console.error('❌ Erro no resumo diário:', err.message);
  }
}

// Alerta de custo mensal quando ultrapassa limite
async function verificarAlertaCusto(limiteUSD = 50) {
  try {
    const mes = new Date().toISOString().substring(0, 7);
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(custo_usd),0) AS total FROM custos WHERE mes_ref=$1`, [mes]);
    const total = parseFloat(rows[0].total);

    if (total >= limiteUSD) {
      const { rows: usuarios } = await pool.query(
        `SELECT numero_whats FROM usuarios WHERE numero_whats IS NOT NULL AND ativo=TRUE AND role='admin'`);

      const msg = `⚠️ *ALERTA DE CUSTO*\n\nO gasto com IA este mês atingiu *US$ ${total.toFixed(2)}*, ultrapassando o limite de US$ ${limiteUSD}.\n\nAcesse o painel financeiro para mais detalhes.`;

      for (const u of usuarios) {
        try { await enviarMensagem(u.numero_whats, msg); } catch {}
      }
    }
  } catch (err) {
    console.error('❌ Erro na verificação de custo:', err.message);
  }
}

function iniciarNotificacoes() {
  // Resumo diário às 07:30
  cron.schedule('30 7 * * *', enviarResumoDiario, { timezone: 'America/Sao_Paulo' });

  // Verificação de custo às 12:00 e 18:00
  cron.schedule('0 12,18 * * *', () => verificarAlertaCusto(50), { timezone: 'America/Sao_Paulo' });

  console.log('✅ Notificações proativas iniciadas');
}

module.exports = { iniciarNotificacoes, enviarResumoDiario, verificarAlertaCusto };
