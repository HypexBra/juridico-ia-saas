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

// `obterAppUrl` virou utilitário genérico em lib/app/url.ts (usado também
// pelo redirect de e-mail do Supabase Auth — convite de equipe/redefinição
// de senha, sem relação com billing) — reexportado aqui pra não quebrar os
// callers existentes deste módulo.
export { obterAppUrl } from "@/lib/app/url";

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
