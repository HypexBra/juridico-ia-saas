# Integração do PWA no projeto v5

## 1. Instalar dependências

```bash
npm install web-push canvas
```

## 2. Gerar chaves VAPID

```bash
node -e "const wp=require('web-push'); console.log(JSON.stringify(wp.generateVAPIDKeys(),null,2))"
```

Copie as chaves geradas e adicione ao `.env`:

```env
VAPID_PUBLIC_KEY=sua_chave_publica_aqui
VAPID_PRIVATE_KEY=sua_chave_privada_aqui
VAPID_EMAIL=admin@seuescritorio.com.br
```

## 3. Gerar ícones

```bash
node gerar-icones.js
```

Isso cria todos os ícones em `public/icons/`.

## 4. Copiar arquivos para o projeto v5

```
public/manifest.json    → assistente-juridico-v5/public/manifest.json
public/sw.js            → assistente-juridico-v5/public/sw.js
public/pwa-client.js    → assistente-juridico-v5/public/pwa-client.js
public/icons/           → assistente-juridico-v5/public/icons/
src/push.js             → assistente-juridico-v5/src/push.js
src/rotas-push.js       → assistente-juridico-v5/src/rotas-push.js
```

## 5. Adicionar rota estática e push no index.js

Adicione após as linhas existentes de `app.use`:

```javascript
const path = require('path');

// Serve arquivos estáticos (SW, manifest, ícones)
app.use(express.static(path.join(__dirname, '../public')));

// Rotas de push notifications
app.use('/push', require('./rotas-push'));
```

## 6. Criar tabela de subscriptions

Adicione ao final do `src/db/setup.js` antes do `finally`:

```javascript
await client.query(`
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
```

## 7. Adicionar tags no <head> de todas as páginas do painel

No arquivo `src/painel.js`, dentro da função `layout()`, adicione no `<head>`:

```html
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#0a1628">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Jurídico IA">
<link rel="apple-touch-icon" href="/icons/icon-192.png">
```

E antes do `</body>`:

```html
<script src="/pwa-client.js"></script>
```

## 8. Disparar push ao criar nova triagem

No `src/index.js`, na função `notificarAdvogados()`, adicione:

```javascript
const push = require('./push');

// Busca usuários com subscription ativa
const { rows: usuarios } = await pool.query(
  `SELECT DISTINCT ps.usuario_id FROM push_subscriptions ps
   JOIN usuarios u ON u.id = ps.usuario_id WHERE u.ativo=TRUE`
);

for (const u of usuarios) {
  await push.notificarUsuario(u.usuario_id,
    push.payloadNovaTriagem(ficha.nome_cliente, ficha.area_direito, ficha.urgencia));
}
```

## 9. Disparar push nos lembretes de prazo

No `src/prazos.js`, após `enviarMensagem(prazo.numero_whats, msg)`:

```javascript
const push = require('./push');
const { rows: subs } = await pool.query(
  `SELECT usuario_id FROM push_subscriptions WHERE usuario_id=$1`, [prazo.usuario_id]);
if (subs.length) {
  await push.notificarUsuario(prazo.usuario_id,
    push.payloadPrazo(prazo.titulo, dias));
}
```

## 10. Testar

1. Acesse o painel via HTTPS (obrigatório para SW e Push)
2. Aguarde 10 segundos — aparece o diálogo de notificações
3. Clique em "Ativar"
4. No painel, vá em qualquer página — aparece o banner "Instalar app"
5. Para testar push manualmente: `POST /push/test` (com sessão ativa)

## Observação sobre HTTPS

Service Workers e Push Notifications só funcionam em HTTPS.
No Railway o HTTPS já vem configurado automaticamente. ✅
Em desenvolvimento local, use `localhost` (exceção do browser) ou ngrok.
