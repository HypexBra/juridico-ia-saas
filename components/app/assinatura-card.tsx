"use client";

import { useActionState } from "react";
import {
  iniciarCheckoutAction,
  abrirPortalAction,
  type AssinaturaActionState,
} from "@/app/app/perfil/actions";
import { Button } from "@/components/ui/button";

const INITIAL_STATE: AssinaturaActionState = { error: null };

/** Preço exibido aqui é só cópia/UI — a cobrança real usa STRIPE_PRICE_ID_PRO_MENSAL (fonte de verdade). Mantenha os dois sincronizados manualmente ao trocar o valor no Stripe. */
const PRECO_PRO_MENSAL = "R$ 149";

const VANTAGENS_PRO = [
  "Redação assistida: a IA redige a peça inteira (petição, contestação, recurso, parecer), não só responde perguntas.",
  "Análise de risco contratual cláusula-por-cláusula (redline) antes de assinar.",
  "Relatórios avançados: realization rate e breakdown financeiro por caso/área.",
  "Mail-merge condicional: automação de documento com lógica por múltiplas fontes.",
  "API/integrações abertas para conectar com outras ferramentas do escritório.",
  "Portal do cliente rico: chat bidirecional e notificação em tempo real.",
];

export function AssinaturaCard({ plano }: { plano: "free" | "pro" }) {
  const [stateCheckout, checkoutFormAction, isPendingCheckout] = useActionState(
    iniciarCheckoutAction,
    INITIAL_STATE,
  );
  const [statePortal, portalFormAction, isPendingPortal] = useActionState(abrirPortalAction, INITIAL_STATE);

  if (plano === "pro") {
    return (
      <form action={portalFormAction} className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <p className="flex-1 text-sm text-muted">
          Escritório no <span className="font-medium text-ice">Plano Pro</span>. Gerencie forma de pagamento ou
          cancele a qualquer momento pelo portal do Stripe.
        </p>
        <Button type="submit" disabled={isPendingPortal}>
          {isPendingPortal ? "Abrindo…" : "Gerenciar assinatura"}
        </Button>
        {statePortal.error && <p className="text-xs text-red-400 sm:ml-3">{statePortal.error}</p>}
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-muted">
          Escritório no <span className="font-medium text-ice">Plano Free</span>.
        </p>
        <p className="text-sm text-muted">
          <span className="font-display text-2xl font-semibold text-ice">{PRECO_PRO_MENSAL}</span>
          <span className="text-xs">/mês no Pro</span>
        </p>
      </div>

      <ul className="space-y-2">
        {VANTAGENS_PRO.map((vantagem) => (
          <li key={vantagem} className="flex items-start gap-2 text-sm text-muted">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className="mt-0.5 shrink-0 text-green"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <span>{vantagem}</span>
          </li>
        ))}
      </ul>

      <form action={checkoutFormAction} className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" disabled={isPendingCheckout} className="sm:w-auto">
          {isPendingCheckout ? "Abrindo checkout…" : "Assinar Plano Pro"}
        </Button>
        {stateCheckout.error && <p className="text-xs text-red-400">{stateCheckout.error}</p>}
      </form>
    </div>
  );
}
