import "server-only";

/**
 * Cliente Stripe minimalista via REST direta (sem instalar o SDK `stripe`).
 * Decisão consciente (ver ADR docs/adrs/0002-billing-scaffold-sem-sdk-stripe.md):
 * enquanto não existe conta/chave Stripe real, evitar puxar uma dependência
 * nova só para código que nunca executa. Quando a integração for para
 * produção de verdade, trocar por `stripe` (SDK oficial, tipagem completa,
 * retries/idempotency-key nativos) é o fast-follow recomendado — este
 * arquivo é só o scaffold que já fecha o contrato de uso no resto do app.
 */

const STRIPE_API_BASE = "https://api.stripe.com/v1";

/** Lançado quando qualquer função daqui é chamada sem `STRIPE_SECRET_KEY` configurada. */
export class StripeNaoConfiguradoError extends Error {
  constructor() {
    super(
      "STRIPE_SECRET_KEY não configurada — billing real desativado. " +
        "Defina a variável de ambiente quando a conta Stripe existir.",
    );
    this.name = "StripeNaoConfiguradoError";
  }
}

function obterChaveSecreta(): string {
  const chave = process.env.STRIPE_SECRET_KEY;
  if (!chave) throw new StripeNaoConfiguradoError();
  return chave;
}

/** `true` só quando há chave configurada — usar para esconder/mostrar CTA de upgrade na UI. */
export function stripeEstaConfigurado(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * URL pública da aplicação usada nos `success_url`/`cancel_url`/`return_url`
 * enviados ao Stripe. Sem `NEXT_PUBLIC_APP_URL`, cai para `localhost` — o que
 * é inofensivo para ABRIR o checkout (Stripe aceita qualquer URL válida),
 * mas quebra silenciosamente o retorno pós-pagamento em produção. Loga um
 * warning (em vez de um fallback 100% silencioso) para esse caso aparecer
 * nos logs do servidor em vez de exigir reproduzir o pagamento pra descobrir.
 */
export function obterAppUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    console.warn(
      "[billing] NEXT_PUBLIC_APP_URL não configurada — usando http://localhost:3000 como fallback " +
        "para success_url/cancel_url/return_url do Stripe. Em produção isso quebra o redirect pós-checkout.",
    );
    return "http://localhost:3000";
  }
  return appUrl;
}

export type CriarCheckoutSessionParams = {
  escritorioId: string;
  priceId: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
  /** Se o escritório já tem `stripe_customer_id` salvo em `assinaturas`, reaproveita — evita duplicar customer no Stripe. */
  stripeCustomerId?: string | null;
};

export type CheckoutSessionCriada = { sessionId: string; url: string };

/**
 * Cria uma Checkout Session (modo `subscription`) para o escritório. Grava
 * `escritorio_id` tanto em `client_reference_id` quanto em `metadata` —
 * redundância intencional: o webhook usa `client_reference_id` primeiro
 * (campo dedicado do Stripe para isso) e cai para `metadata` se ausente.
 */
export async function criarCheckoutSession(params: CriarCheckoutSessionParams): Promise<CheckoutSessionCriada> {
  const chave = obterChaveSecreta();

  const body = new URLSearchParams();
  body.set("mode", "subscription");
  body.set("line_items[0][price]", params.priceId);
  body.set("line_items[0][quantity]", "1");
  body.set("success_url", params.successUrl);
  body.set("cancel_url", params.cancelUrl);
  body.set("client_reference_id", params.escritorioId);
  body.set("metadata[escritorio_id]", params.escritorioId);
  if (params.stripeCustomerId) {
    body.set("customer", params.stripeCustomerId);
  } else if (params.customerEmail) {
    body.set("customer_email", params.customerEmail);
  }

  const resposta = await fetch(`${STRIPE_API_BASE}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${chave}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!resposta.ok) {
    const corpoErro = await resposta.text();
    throw new Error(`Stripe checkout session falhou (HTTP ${resposta.status}): ${corpoErro}`);
  }

  const sessao = (await resposta.json()) as { id: string; url: string | null };
  if (!sessao.url) throw new Error("Stripe retornou checkout session sem `url`.");
  return { sessionId: sessao.id, url: sessao.url };
}

/**
 * Cria um link para o Customer Portal do Stripe (cancelamento/troca de
 * cartão self-service). Usar na tela "minha assinatura" quando
 * `assinaturas.stripe_customer_id` já existir.
 */
export async function criarPortalSessionUrl(stripeCustomerId: string, returnUrl: string): Promise<string> {
  const chave = obterChaveSecreta();

  const body = new URLSearchParams();
  body.set("customer", stripeCustomerId);
  body.set("return_url", returnUrl);

  const resposta = await fetch(`${STRIPE_API_BASE}/billing_portal/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${chave}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!resposta.ok) {
    const corpoErro = await resposta.text();
    throw new Error(`Stripe billing portal session falhou (HTTP ${resposta.status}): ${corpoErro}`);
  }

  const sessao = (await resposta.json()) as { url: string };
  return sessao.url;
}
