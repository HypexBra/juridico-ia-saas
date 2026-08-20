import { NextResponse } from "next/server";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { criarPortalSessionUrl, obterAppUrl, StripeNaoConfiguradoError } from "@/lib/billing/stripe-client";
import type { Assinatura } from "@/lib/types";

/**
 * Abre o Customer Portal do Stripe (cancelamento/troca de cartão
 * self-service) para o escritório já assinante. Espelha as mesmas regras de
 * acesso de `app/api/billing/checkout/route.ts`.
 */
export async function POST() {
  const usuario = await getUsuarioAtual();
  if (!usuario) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (usuario.perfil.role !== "owner") {
    return NextResponse.json(
      { error: "Só o titular (owner) do escritório pode gerenciar a assinatura." },
      { status: 403 },
    );
  }

  const appUrl = obterAppUrl();

  try {
    const supabase = await createClient();
    const { data: assinatura } = await supabase
      .from("assinaturas")
      .select("stripe_customer_id")
      .eq("escritorio_id", usuario.perfil.escritorio_id)
      .maybeSingle<Pick<Assinatura, "stripe_customer_id">>();

    if (!assinatura?.stripe_customer_id) {
      return NextResponse.json({ error: "Nenhuma assinatura Stripe encontrada para este escritório." }, { status: 404 });
    }

    const url = await criarPortalSessionUrl(assinatura.stripe_customer_id, `${appUrl}/app/perfil`);
    return NextResponse.json({ url });
  } catch (erro) {
    if (erro instanceof StripeNaoConfiguradoError) {
      return NextResponse.json({ error: erro.message }, { status: 501 });
    }
    console.error("[api/billing/portal] Falha ao criar portal session:", erro);
    return NextResponse.json({ error: "Falha ao abrir portal de assinatura." }, { status: 500 });
  }
}
