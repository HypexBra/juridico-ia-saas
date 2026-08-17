// Push Notifications via Web Push Protocol
// Instale: npm install web-push
// Gere as chaves VAPID: node -e "const wp=require('web-push');console.log(wp.generateVAPIDKeys())"

const webpush = require('web-push');
const pool    = require('./db/pool');

// Configura VAPID (coloque as chaves no .env)
webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL || 'admin@juridico.com'}`,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// ── BANCO: tabela de subscriptions ────────────────────────
async function criarTabelaSubscriptions() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id         SERIAL PRIMARY KEY,
      usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
      endpoint   TEXT NOT NULL,
      p256dh     TEXT NOT NULL,
      auth       TEXT NOT NULL,
      criado_em  TIMESTAMP DEFAULT NOW(),
      UNIQUE (endpoint)
    )
  `);
}

// Salva subscription de um usuário
async function salvarSubscription(usuarioId, subscription) {
  await pool.query(`
    INSERT INTO push_subscriptions (usuario_id, endpoint, p256dh, auth)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (endpoint) DO UPDATE SET usuario_id=$1, p256dh=$3, auth=$4`,
    [usuarioId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]);
}

// Remove subscription
async function removerSubscription(endpoint) {
  await pool.query(`DELETE FROM push_subscriptions WHERE endpoint=$1`, [endpoint]);
}

// Busca subscriptions de um usuário
async function getSubscriptions(usuarioId) {
  const { rows } = await pool.query(
    `SELECT * FROM push_subscriptions WHERE usuario_id=$1`, [usuarioId]);
  return rows;
}

// Busca todas as subscriptions
async function getAllSubscriptions() {
  const { rows } = await pool.query(`SELECT * FROM push_subscriptions`);
  return rows;
}

// ── ENVIO ─────────────────────────────────────────────────

// Envia push para um usuário específico
async function notificarUsuario(usuarioId, payload) {
  const subs = await getSubscriptions(usuarioId);
  return enviarParaSubscriptions(subs, payload);
}

// Envia push para todos os usuários
async function notificarTodos(payload) {
  const subs = await getAllSubscriptions();
  return enviarParaSubscriptions(subs, payload);
}

async function enviarParaSubscriptions(subs, payload) {
  const resultados = [];
  for (const sub of subs) {
    const subscription = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth }
    };
    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload));
      resultados.push({ ok: true, endpoint: sub.endpoint.substring(0, 30) });
    } catch (err) {
      console.error('❌ Push falhou:', err.statusCode, sub.endpoint.substring(0, 30));
      // Remove subscription inválida
      if (err.statusCode === 410 || err.statusCode === 404) {
        await removerSubscription(sub.endpoint);
      }
      resultados.push({ ok: false, error: err.statusCode });
    }
  }
  return resultados;
}

// ── PAYLOADS PRÉ-DEFINIDOS ────────────────────────────────

function payloadNovaTriagem(nomeCliente, area, urgencia) {
  return {
    title: urgencia === 'alta' ? '🔴 URGENTE — Nova triagem' : '🆕 Nova triagem de cliente',
    body:  `${nomeCliente || 'Cliente'} — Área: ${area || 'A identificar'}`,
    icon:  '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    tag:   'nova-triagem',
    url:   '/painel/fichas?naoLidas=1',
    actions: [
      { action: 'ver',    title: '👁️ Ver ficha' },
      { action: 'fechar', title: 'Fechar'        }
    ]
  };
}

function payloadPrazo(titulo, diasRestantes) {
  const emoji = diasRestantes === 0 ? '🔴' : diasRestantes === 1 ? '🟡' : '🟢';
  const quando = diasRestantes === 0 ? 'HOJE' : diasRestantes === 1 ? 'AMANHÃ' : `em ${diasRestantes} dias`;
  return {
    title: `${emoji} Prazo vencendo ${quando}`,
    body:  titulo,
    icon:  '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    tag:   'prazo',
    url:   '/painel/prazos',
    actions: [
      { action: 'ver',    title: '📅 Ver prazos' },
      { action: 'fechar', title: 'Fechar'         }
    ]
  };
}

function payloadAlertaCusto(valorUSD) {
  return {
    title: '⚠️ Alerta de custo',
    body:  `Gasto com IA este mês: US$ ${valorUSD}`,
    icon:  '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    tag:   'custo',
    url:   '/painel/financeiro'
  };
}

module.exports = {
  criarTabelaSubscriptions,
  salvarSubscription,
  removerSubscription,
  notificarUsuario,
  notificarTodos,
  payloadNovaTriagem,
  payloadPrazo,
  payloadAlertaCusto
};
