const cron = require('node-cron');
const pool = require('./db/pool');
const { enviarMensagem } = require('./whatsapp');

// Busca prazos que precisam de lembrete hoje
async function verificarPrazos() {
  const { rows } = await pool.query(`
    SELECT p.*, u.nome AS nome_usuario, u.numero_whats
    FROM prazos p
    JOIN usuarios u ON u.id = p.usuario_id
    WHERE p.concluido = FALSE
      AND u.numero_whats IS NOT NULL
      AND u.ativo = TRUE
      AND (
        (data_prazo = CURRENT_DATE + 7 AND lembrete_7 = FALSE)
        OR (data_prazo = CURRENT_DATE + 3 AND lembrete_3 = FALSE)
        OR (data_prazo = CURRENT_DATE + 1 AND lembrete_1 = FALSE)
        OR (data_prazo = CURRENT_DATE AND lembrete_1 = FALSE)
      )
  `);
  return rows;
}

async function enviarLembretes() {
  try {
    const prazos = await verificarPrazos();
    if (!prazos.length) return;

    console.log(`⏰ Verificando ${prazos.length} prazo(s)...`);

    for (const prazo of prazos) {
      const hoje    = new Date();
      const vence   = new Date(prazo.data_prazo);
      const diffMs  = vence - hoje;
      const dias    = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      let campo = null;
      let emoji = '⏰';
      let urgencia = '';

      if (dias <= 1) { campo = 'lembrete_1'; emoji = '🔴'; urgencia = 'HOJE/AMANHÃ — URGENTE!'; }
      else if (dias <= 3) { campo = 'lembrete_3'; emoji = '🟡'; urgencia = `em ${dias} dias`; }
      else if (dias <= 7) { campo = 'lembrete_7'; emoji = '🟢'; urgencia = `em ${dias} dias`; }

      if (!campo) continue;

      const msg = `${emoji} *LEMBRETE DE PRAZO*

📁 *${prazo.titulo}*
${prazo.cliente_nome ? `👤 Cliente: ${prazo.cliente_nome}` : ''}
${prazo.processo ? `📄 Processo: ${prazo.processo}` : ''}
📅 *Vence: ${new Date(prazo.data_prazo).toLocaleDateString('pt-BR')} (${urgencia})*
${prazo.descricao ? `\n📝 ${prazo.descricao}` : ''}

Acesse o painel para marcar como concluído.`;

      try {
        await enviarMensagem(prazo.numero_whats, msg);
        await pool.query(`UPDATE prazos SET ${campo} = TRUE WHERE id = $1`, [prazo.id]);
        console.log(`✅ Lembrete enviado para ${prazo.numero_whats}: ${prazo.titulo}`);
      } catch (err) {
        console.error(`❌ Erro ao enviar lembrete para ${prazo.numero_whats}:`, err.message);
      }
    }
  } catch (err) {
    console.error('❌ Erro ao verificar prazos:', err.message);
  }
}

// Agenda verificação todos os dias às 08:00
function iniciarAgendador() {
  cron.schedule('0 8 * * *', () => {
    console.log('⏰ Verificando prazos agendados...');
    enviarLembretes();
  }, { timezone: 'America/Sao_Paulo' });

  console.log('✅ Agendador de prazos iniciado (08:00 diário)');
}

// CRUD de prazos
async function criarPrazo(dados) {
  const { rows } = await pool.query(`
    INSERT INTO prazos (usuario_id, titulo, descricao, data_prazo, processo, cliente_nome)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [dados.usuarioId, dados.titulo, dados.descricao, dados.dataPrazo, dados.processo, dados.clienteNome]);
  return rows[0];
}

async function listarPrazos(usuarioId = null, incluirConcluidos = false) {
  let where = incluirConcluidos ? '' : 'WHERE p.concluido = FALSE';
  if (usuarioId) where += (where ? ' AND' : 'WHERE') + ` p.usuario_id = ${usuarioId}`;

  const { rows } = await pool.query(`
    SELECT p.*, u.nome AS nome_usuario
    FROM prazos p JOIN usuarios u ON u.id = p.usuario_id
    ${where}
    ORDER BY p.data_prazo ASC`);
  return rows;
}

async function concluirPrazo(id) {
  await pool.query(`UPDATE prazos SET concluido=TRUE WHERE id=$1`, [id]);
}

async function deletarPrazo(id) {
  await pool.query(`DELETE FROM prazos WHERE id=$1`, [id]);
}

module.exports = { iniciarAgendador, enviarLembretes, criarPrazo, listarPrazos, concluirPrazo, deletarPrazo };
