# 0002 — Scaffold de billing via REST + HMAC manual, sem instalar o SDK `stripe`

## Status

Aceito (2026-08-19)

## Contexto

O usuário pediu a infraestrutura de billing pronta para plugar uma chave Stripe real
mais tarde, mas **sem conta Stripe hoje** e sem cobrança real a implementar nesta rodada.
Era preciso decidir se a rota de checkout (`app/api/billing/checkout`) e o webhook de
assinatura (`app/api/webhooks/stripe`) deveriam já depender do SDK oficial `stripe`
(pacote npm) ou de chamadas HTTP diretas à API REST do Stripe.

## Decisão

O scaffold (`lib/billing/stripe-client.ts`, `lib/billing/verificar-assinatura-webhook.ts`)
usa `fetch` direto contra `https://api.stripe.com/v1/*` para criar Checkout Session e
Billing Portal Session, e verificação manual de assinatura HMAC-SHA256 (`node:crypto`,
mesmo esquema documentado pelo Stripe para o header `Stripe-Signature`) em vez do
`stripe.webhooks.constructEvent` do SDK oficial. Nenhuma dependência nova foi adicionada
a `package.json`.

Sem `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`/`STRIPE_PRICE_ID_PRO_MENSAL`
configuradas: `app/api/billing/checkout` responde HTTP 501 com mensagem explícita, e
`app/api/webhooks/stripe` rejeita 100% dos payloads com HTTP 401 (a função de
verificação sempre retorna `false` sem segredo configurado). Nada quebra o build; nada
executa de fato.

## Consequências

**Positivas**

- Zero risco de o scaffold quebrar `npm run build`/`npm install` por uma dependência
  nova antes de haver conta Stripe real para testar de ponta a ponta.
- Superfície mínima: 2 arquivos pequenos, fáceis de ler e substituir depois.
- O contrato de uso (`criarCheckoutSession`, `criarPortalSessionUrl`,
  `validarAssinaturaWebhookStripe`) já é estável para o resto do app (rotas de API) — a
  troca futura por SDK fica isolada nesses 2 arquivos, sem tocar nas rotas que os
  chamam.

**Negativas**

- Perde recursos do SDK oficial: tipagem completa dos objetos Stripe, retries
  automáticos, idempotency keys automáticas, paginação helpers.
- Os `type`s dos payloads de webhook (`CheckoutSessionCompletedPayload`,
  `SubscriptionPayload` em `app/api/webhooks/stripe/route.ts`) são declarados à mão e
  cobrem só os campos usados — não são o tipo completo de uma `Subscription`/`Session`
  do Stripe; expandir o uso exige expandir esses tipos manualmente.

## Mitigação / fast-follow recomendado

Quando a conta Stripe real existir e o time for para produção: instalar `stripe`
(`npm install stripe`), substituir o corpo de `lib/billing/stripe-client.ts` pelas
chamadas do SDK (`stripe.checkout.sessions.create`, `stripe.billingPortal.sessions.create`)
e `validarAssinaturaWebhookStripe` por `stripe.webhooks.constructEvent`. As assinaturas de
função já definidas neste scaffold foram desenhadas para não exigir mudança nos
chamadores (`app/api/billing/checkout/route.ts`, `app/api/webhooks/stripe/route.ts`).

## Alternativas consideradas

1. **Instalar `stripe` agora, mesmo sem chave** — mais "pronto para produção", mas
   adiciona ~1MB de dependência não usada de fato (nenhuma chamada real acontece sem
   chave) e expande a superfície de tipos/imports para revisar antes que haja qualquer
   integração real testável. Rejeitada por ora; é o fast-follow natural quando a chave
   existir.
2. **Não criar rota de webhook nenhuma até haver conta Stripe** — deixaria o pedido
   explícito do usuário ("scaffold pronto pra plugar depois") sem atender; a rota vazia-mas-seguros
   (401 sem segredo) é o meio-termo pedido.
