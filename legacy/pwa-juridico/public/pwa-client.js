// ── PWA CLIENT ────────────────────────────────────────────
// Cole este script em todas as páginas do painel (antes do </body>)

(async function() {
  'use strict';

  // Verifica suporte
  if (!('serviceWorker' in navigator)) return;
  if (!('PushManager'   in window))    return;

  // ── Registra Service Worker ──────────────────────────────
  let swReg;
  try {
    swReg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    console.log('[PWA] Service Worker registrado:', swReg.scope);
  } catch (err) {
    console.error('[PWA] Falha ao registrar SW:', err);
    return;
  }

  // ── Banner de instalação (A2HS) ──────────────────────────
  let deferredPrompt;

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    mostrarBannerInstalacao();
  });

  function mostrarBannerInstalacao() {
    // Não mostra se já está instalado
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    // Não mostra se usuário já dispensou
    if (localStorage.getItem('pwa-dispensado')) return;

    const banner = document.createElement('div');
    banner.id = 'pwa-banner';
    banner.innerHTML = `
      <div style="
        position:fixed;bottom:1rem;left:50%;transform:translateX(-50%);
        background:#1e293b;border:1px solid rgba(201,168,76,.3);
        border-radius:14px;padding:1rem 1.25rem;
        display:flex;align-items:center;gap:1rem;
        box-shadow:0 8px 32px rgba(0,0,0,.4);
        z-index:9999;max-width:380px;width:calc(100% - 2rem);
        font-family:-apple-system,sans-serif;
      ">
        <div style="font-size:1.75rem;flex-shrink:0">⚖️</div>
        <div style="flex:1">
          <div style="font-size:.85rem;font-weight:600;color:#f8fafc;margin-bottom:.2rem">
            Instalar Jurídico IA
          </div>
          <div style="font-size:.75rem;color:#8a9ab5;line-height:1.4">
            Acesse o painel como um app direto da tela inicial
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:.4rem;flex-shrink:0">
          <button id="pwa-instalar" style="
            padding:.4rem .875rem;background:linear-gradient(135deg,#c9a84c,#e8c96a);
            color:#0a1628;border:none;border-radius:8px;font-size:.78rem;
            font-weight:600;cursor:pointer;white-space:nowrap
          ">Instalar</button>
          <button id="pwa-dispensar" style="
            padding:.4rem .875rem;background:transparent;
            color:#8a9ab5;border:1px solid #334155;border-radius:8px;
            font-size:.78rem;cursor:pointer
          ">Agora não</button>
        </div>
      </div>
    `;

    document.body.appendChild(banner);

    document.getElementById('pwa-instalar').onclick = async () => {
      banner.remove();
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log('[PWA] Instalação:', outcome);
      deferredPrompt = null;
    };

    document.getElementById('pwa-dispensar').onclick = () => {
      banner.remove();
      localStorage.setItem('pwa-dispensado', '1');
    };
  }

  // ── Push Notifications ───────────────────────────────────
  async function pedirPermissaoNotificacoes() {
    if (Notification.permission === 'granted') {
      await assinarPush();
      return;
    }

    if (Notification.permission === 'denied') return;

    // Mostra diálogo explicativo antes de pedir permissão do browser
    const dialog = document.createElement('div');
    dialog.innerHTML = `
      <div id="push-dialog" style="
        position:fixed;top:1rem;right:1rem;
        background:#1e293b;border:1px solid rgba(201,168,76,.3);
        border-radius:14px;padding:1.25rem;max-width:300px;
        box-shadow:0 8px 32px rgba(0,0,0,.4);z-index:9999;
        font-family:-apple-system,sans-serif;
      ">
        <div style="font-size:1.25rem;margin-bottom:.75rem">🔔</div>
        <div style="font-size:.85rem;font-weight:600;color:#f8fafc;margin-bottom:.4rem">
          Ativar notificações?
        </div>
        <div style="font-size:.78rem;color:#8a9ab5;line-height:1.5;margin-bottom:1rem">
          Receba alertas de novas triagens e prazos vencendo — mesmo com o painel fechado.
        </div>
        <div style="display:flex;gap:.5rem">
          <button id="push-sim" style="
            flex:1;padding:.5rem;background:linear-gradient(135deg,#c9a84c,#e8c96a);
            color:#0a1628;border:none;border-radius:8px;font-size:.8rem;
            font-weight:600;cursor:pointer
          ">Ativar</button>
          <button id="push-nao" style="
            flex:1;padding:.5rem;background:transparent;
            color:#8a9ab5;border:1px solid #334155;border-radius:8px;
            font-size:.8rem;cursor:pointer
          ">Não agora</button>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);

    document.getElementById('push-sim').onclick = async () => {
      dialog.remove();
      const perm = await Notification.requestPermission();
      if (perm === 'granted') await assinarPush();
    };

    document.getElementById('push-nao').onclick = () => {
      dialog.remove();
      sessionStorage.setItem('push-recusado', '1');
    };
  }

  async function assinarPush() {
    try {
      // Busca a chave pública VAPID do servidor
      const resp = await fetch('/push/vapid-key');
      const { publicKey } = await resp.json();

      const sub = await swReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      // Envia subscription para o servidor
      await fetch('/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub })
      });

      console.log('[PWA] Push subscription ativada!');
    } catch (err) {
      console.error('[PWA] Erro ao assinar push:', err);
    }
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw     = window.atob(base64);
    const arr     = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }

  // ── Background Sync ──────────────────────────────────────
  async function registrarBackgroundSync() {
    if (!('SyncManager' in window)) return;
    try {
      await swReg.sync.register('sync-fichas');
      console.log('[PWA] Background sync registrado');
    } catch {}
  }

  // ── Indicador de status online/offline ──────────────────
  function monitorarConexao() {
    const bar = document.createElement('div');
    bar.id = 'conexao-bar';
    bar.style.cssText = `
      position:fixed;bottom:0;left:0;right:0;z-index:9998;
      padding:.5rem;text-align:center;font-size:.78rem;font-weight:500;
      font-family:-apple-system,sans-serif;display:none;
    `;
    document.body.appendChild(bar);

    function atualizar() {
      if (navigator.onLine) {
        bar.style.background = '#064e3b';
        bar.style.color = '#34d399';
        bar.textContent = '✅ Conexão restaurada';
        bar.style.display = 'block';
        setTimeout(() => { bar.style.display = 'none'; }, 3000);
      } else {
        bar.style.background = '#450a0a';
        bar.style.color = '#fca5a5';
        bar.textContent = '⚠️ Você está offline — dados podem estar desatualizados';
        bar.style.display = 'block';
      }
    }

    window.addEventListener('online',  atualizar);
    window.addEventListener('offline', atualizar);
  }

  // ── Inicializa tudo ──────────────────────────────────────
  monitorarConexao();
  registrarBackgroundSync();

  // Pede notificações após 10s (não ser invasivo no carregamento)
  if (!sessionStorage.getItem('push-recusado') && Notification.permission !== 'denied') {
    setTimeout(pedirPermissaoNotificacoes, 10000);
  }

  // Atualiza SW em background quando nova versão disponível
  swReg.addEventListener('updatefound', () => {
    const newSW = swReg.installing;
    newSW.addEventListener('statechange', () => {
      if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
        // Avisa usuário que há atualização disponível
        const toast = document.createElement('div');
        toast.innerHTML = `
          <div style="
            position:fixed;top:1rem;right:1rem;
            background:#1e293b;border:1px solid rgba(201,168,76,.3);
            border-radius:10px;padding:.875rem 1rem;z-index:9999;
            font-family:-apple-system,sans-serif;display:flex;gap:.75rem;align-items:center;
          ">
            <span style="font-size:.82rem;color:#e2e8f0">Nova versão disponível</span>
            <button onclick="location.reload()" style="
              padding:.3rem .75rem;background:#c9a84c;color:#0a1628;
              border:none;border-radius:6px;font-size:.75rem;font-weight:600;cursor:pointer
            ">Atualizar</button>
          </div>
        `;
        document.body.appendChild(toast);
      }
    });
  });

})();
