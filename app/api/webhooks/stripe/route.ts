import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validarAssinaturaWebhookStripe } from "@/lib/billing/verificar-assinatura-webhook";
import type { StatusAssinaturaStripe } from "@/lib/types";

/**
 * Webhook do Stripe: única rota autorizada a escrever `escritorios.plano`
 * (RLS em `escritorios_update`, migration 0012, bloqueia qualquer troca de
 * `plano`/`features_overrides` vinda do client — só `service_role` passa).
 *
 * Sem `STRIPE_WEBHOOK_SECRET` configurada, `validarAssinaturaWebhookStripe`
 * sempre retorna `false` e esta rota responde 401 para QUALQUER payload —
 * estruturalmente pronta, mas inerte até a chave existir (ver CLAUDE.md).
 *
 * Roda sem sessão de usuário (chamada server-to-server pelo Stripe), por
 * isso usa `service_role` — mesmo padrão do webhook do Autentique em
 * `app/api/webhooks/assinatura/route.ts`.
 */

/**
 * Status de subscription do Stripe que mantêm o escritório em `plano =
 * 'pro'`. Inclui `trialing` (período de teste) e `past_due` (falha de
 * pagamento, mas o Stripe ainda está tentando recobrar automaticamente
 * pelo retry schedule configurado no Dashboard) — downgrade real só
 * acontece quando a subscription chega a um status terminal
 * (`canceled`/`unpaid`/`incomplete_expired`).
 */
const STATUS_QUE_MANTEM_PRO = new Set<StatusAssinaturaStripe>(["active", "trialing", "past_due"]);

type EventoStripe = { type: string; data: { object: Record<string, unknown> } };

type CheckoutSessionCompletedPayload = {
  client_reference_id: string | null;
  customer: string | null;
  subscription: string | null;
  metadata?: { escritorio_id?: string };
};

type SubscriptionPayload = {
  id: string;
  status: string;
  cancel_at_period_end: boolean;
  current_period_end: number;
  items?: { data?: Array<{ price?: { id?: string } }> };
};

export async function POST(request: NextRequest) {
  const corpoBruto = await request.text();
  const assinaturaHeader = request.headers.get("stripe-signature");

  if (!validarAssinaturaWebhookStripe(corpoBruto, assinaturaHeader)) {
    return NextResponse.json(
      { error: "Assinatura do webhook inválida, ausente, ou Stripe não configurado neste ambiente." },
      { status: 401 },
    );
  }

  let evento: EventoStripe;
  try {
    evento = JSON.parse(corpoBruto);
  } catch {
    return NextResponse.json({ error: "Payload não é JSON válido." }, { status: 400 });
  }

  const supabase = createAdminClient();

  switch (evento.type) {
    case "checkout.session.completed": {
      const sessao = evento.data.object as unknown as CheckoutSessionCompletedPayload;
      const escritorioId = sessao.client_reference_id ?? sessao.metadata?.escritorio_id ?? null;
      if (!escritorioId || !sessao.customer || !sessao.subscription) break;

      await supabase.from("assinaturas").upsert(
        {
          escritorio_id: escritorioId,
          stripe_customer_id: sessao.customer,
          stripe_subscription_id: sessao.subscription,
          status: "active" satisfies StatusAssinaturaStripe,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: "escritorio_id" },
      );

      await supabase.from("escritorios").update({ plano: "pro" }).eq("id", escritorioId);
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = evento.data.object as unknown as SubscriptionPayload;

      const { data: assinatura } = await supabase
        .from("assinaturas")
        .select("escritorio_id")
        .eq("stripe_subscription_id", subscription.id)
        .maybeSingle<{ escritorio_id: string }>();
      if (!assinatura) break;

      const status = subscription.status as StatusAssinaturaStripe;

      await supabase
        .from("assinaturas")
        .update({
          status,
          stripe_price_id: subscription.items?.data?.[0]?.price?.id ?? null,
          current_period_end: subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : null,
          cancel_at_period_end: subscription.cancel_at_period_end,
          atualizado_em: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", subscription.id);

      await supabase
        .from("escritorios")
        .update({ plano: STATUS_QUE_MANTEM_PRO.has(status) ? "pro" : "free" })
        .eq("id", assinatura.escritorio_id);
      break;
    }

    default:
      // Outros tipos de evento (invoice.*, payment_intent.*, etc.) não têm
      // efeito no gating hoje — ignorados sem erro, o Stripe não reenvia.
      break;
  }

  return NextResponse.json({ ok: true });
}
