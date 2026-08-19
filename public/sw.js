// Service worker mínimo — só o suficiente pra instalabilidade do PWA e um
// fallback offline decente. Deliberadamente NÃO faz cache-first de páginas
// do app (dashboard, chat, fichas etc): é um SaaS com dado sempre mutável
// por escritório, servir uma versão em cache por engano seria pior que não
// funcionar offline. Só assets estáticos (ícones, fontes) usam cache-first.
const CACHE_ESTATICO = "juridico-ia-estatico-v1";
const ASSETS_ESTATICOS = ["/icon-192.png", "/icon-512.png", "/offline.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_ESTATICO).then((cache) => cache.addAll(ASSETS_ESTATICOS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((chave) => chave !== CACHE_ESTATICO).map((chave) => caches.delete(chave))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const ehAssetEstatico = ASSETS_ESTATICOS.some((asset) => url.pathname === asset);

  if (ehAssetEstatico) {
    event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request)));
    return;
  }

  // Navegação (troca de página): sempre tenta a rede primeiro — só cai no
  // fallback offline quando REALMENTE não há conexão, nunca serve HTML
  // desatualizado de um SaaS com dado mutável.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
  }
});
