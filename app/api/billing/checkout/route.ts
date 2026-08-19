import { NextResponse } from "next/server";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { criarCheckoutSession, StripeNaoConfiguradoError } from "@/lib/billing/stripe-client";
import type { Assinatura } from "@/lib/types";

/**
 * Inicia o upgrade para o plano Pro: cria uma Checkout Session no Stripe e
 * devolve a `url` para o client redirecionar (`window.location.href = url`).
 *
 * Sem `STRIPE_SECRET_KEY`/`STRIPE_PRICE_ID_PRO_MENSAL` configuradas, esta
 * rota responde 501 (Not Implemented) de forma explícita — nunca falha
 * silenciosamente nem finge sucesso. É o comportamento esperado hoje: o
 * escritório ainda não tem conta Stripe (ver CLAUDE.md deste projeto).
 *
 * O `plano` do escritório NUNCA é alterado aqui — só o webhook
 * (`app/api/webhooks/stripe/route.ts`, via `service_role`) grava `plano`
 * após o Stripe confirmar o pagamento. Esta rota só abre a sessão de
 * checkout.
 */
export async function POST() {
  const usuario = await getUsuarioAtual();
  if (!usuario) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (usuario.perfil.role !== "owner") {
    return NextResponse.json(
      { error: "Só o titular (owner) do escritório pode iniciar uma assinatura." },
      { status: 403 },
    );
  }
  if (usuario.perfil.escritorio.plano === "pro") {
    return NextResponse.json({ error: "Este escritório já está no plano Pro." }, { status: 409 });
  }

  const priceId = process.env.STRIPE_PRICE_ID_PRO_MENSAL;
  if (!priceId) {
    return NextResponse.json(
      { error: "Billing ainda não configurado neste ambiente (STRIPE_PRICE_ID_PRO_MENSAL ausente)." },
      { status: 501 },
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const supabase = await createClient();
    const { data: assinaturaExistente } = await supabase
      .from("assinaturas")
      .select("stripe_customer_id")
      .eq("escritorio_id", usuario.perfil.escritorio_id)
      .maybeSingle<Pick<Assinatura, "stripe_customer_id">>();

    const { url } = await criarCheckoutSession({
      escritorioId: usuario.perfil.escritorio_id,
      priceId,
      customerEmail: usuario.email ?? "",
      successUrl: `${appUrl}/app/perfil?checkout=sucesso`,
      cancelUrl: `${appUrl}/app/perfil?checkout=cancelado`,
      stripeCustomerId: assinaturaExistente?.stripe_customer_id ?? null,
    });

    return NextResponse.json({ url });
  } catch (erro) {
    if (erro instanceof StripeNaoConfiguradoError) {
      return NextResponse.json({ error: erro.message }, { status: 501 });
    }
    console.error("[api/billing/checkout] Falha ao criar checkout session:", erro);
    return NextResponse.json({ error: "Falha ao iniciar checkout." }, { status: 500 });
  }
}
