const express = require('express');
const router  = express.Router();
const push    = require('./push');
const { autenticado } = require('./auth');

// Retorna a chave pública VAPID para o frontend
router.get('/vapid-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// Salva subscription do usuário logado
router.post('/subscribe', autenticado, async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription?.endpoint) return res.status(400).json({ error: 'Subscription inválida' });
    await push.salvarSubscription(req.session.usuario.id, subscription);
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Erro ao salvar subscription:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// Remove subscription
router.post('/unsubscribe', autenticado, async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (endpoint) await push.removerSubscription(endpoint);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// Teste — envia push manual (só admin)
router.post('/test', autenticado, async (req, res) => {
  try {
    const resultado = await push.notificarUsuario(req.session.usuario.id, {
      title: '✅ Teste de notificação',
      body:  'Push notifications funcionando no Jurídico IA!',
      icon:  '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      tag:   'teste',
      url:   '/painel'
    });
    res.json({ ok: true, resultado });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
