const CACHE_NAME     = 'juridico-ia-v1';
const CACHE_STATIC   = 'juridico-static-v1';
const CACHE_DYNAMIC  = 'juridico-dynamic-v1';

// Recursos que ficam em cache offline
const STATIC_ASSETS = [
  '/painel',
  '/painel/fichas',
  '/painel/prazos',
  '/painel/conversas',
  '/painel/busca',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// ── INSTALL ──────────────────────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Instalando...');
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ─────────────────────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Ativando...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_STATIC && k !== CACHE_DYNAMIC)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH (Stale While Revalidate) ────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignora requisições não-GET e de outros domínios
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // API calls — sempre busca na rede (não cacheia)
  if (url.pathname.startsWith('/painel/api/') || url.pathname === '/webhook') return;

  event.respondWith(
    caches.open(CACHE_DYNAMIC).then(async cache => {
      const cached = await cache.match(request);

      const fetchPromise = fetch(request)
        .then(response => {
          if (response && response.status === 200) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => null);

      // Retorna cache imediatamente se disponível, atualiza em background
      return cached || fetchPromise || new Response(offlinePage(), {
        headers: { 'Content-Type': 'text/html' }
      });
    })
  );
});

// ── PUSH NOTIFICATIONS ────────────────────────────────────
self.addEventListener('push', event => {
  const data = event.data?.json() || {};

  const options = {
    body:    data.body    || 'Nova atualização no painel jurídico.',
    icon:    data.icon    || '/icons/icon-192.png',
    badge:   data.badge   || '/icons/icon-72.png',
    tag:     data.tag     || 'juridico-notif',
    renotify: true,
    data:    data.url     || '/painel',
    actions: data.actions || [
      { action: 'ver',    title: 'Ver agora' },
      { action: 'fechar', title: 'Fechar'    }
    ],
    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || '⚖️ Jurídico IA', options)
  );
});

// ── NOTIFICATION CLICK ────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'fechar') return;

  const url = event.notification.data || '/painel';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Foca janela já aberta se existir
      for (const client of clientList) {
        if (client.url.includes('/painel') && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Abre nova janela
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ── SYNC (Background Sync) ────────────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-fichas') {
    event.waitUntil(
      fetch('/painel/api/stats')
        .then(r => r.json())
        .then(data => {
          if (data.fichas_nao_lidas > 0) {
            return self.registration.showNotification('⚖️ Jurídico IA', {
              body: `${data.fichas_nao_lidas} triagem(s) de cliente aguardando análise.`,
              icon: '/icons/icon-192.png',
              data: '/painel/fichas?naoLidas=1'
            });
          }
        })
        .catch(() => null)
    );
  }
});

// ── PÁGINA OFFLINE ────────────────────────────────────────
function offlinePage() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Sem conexão — Jurídico IA</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,sans-serif;background:#0a1628;color:#e2e8f0;
         min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:2rem}
    .icon{font-size:4rem;margin-bottom:1.5rem}
    h1{font-size:1.5rem;font-weight:600;margin-bottom:.75rem}
    p{font-size:.9rem;color:#8a9ab5;line-height:1.7;margin-bottom:2rem;max-width:320px}
    button{padding:.75rem 2rem;background:#c9a84c;color:#0a1628;border:none;border-radius:10px;
           font-size:.9rem;font-weight:600;cursor:pointer}
  </style>
</head>
<body>
  <div>
    <div class="icon">⚖️</div>
    <h1>Sem conexão</h1>
    <p>Você está offline. Algumas páginas do painel estão disponíveis em cache. Reconecte-se para ver os dados mais recentes.</p>
    <button onclick="location.reload()">Tentar novamente</button>
  </div>
</body>
</html>`;
}
