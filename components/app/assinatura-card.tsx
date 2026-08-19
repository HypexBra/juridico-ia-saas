"use client";

import { useActionState } from "react";
import {
  iniciarCheckoutAction,
  abrirPortalAction,
  type AssinaturaActionState,
} from "@/app/app/perfil/actions";
import { Button } from "@/components/ui/button";

const INITIAL_STATE: AssinaturaActionState = { error: null };

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
    <form action={checkoutFormAction} className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <p className="flex-1 text-sm text-muted">
        Escritório no <span className="font-medium text-ice">Plano Free</span>. Assine o Pro para liberar redação
        assistida de peças completas, análise de risco contratual, relatórios avançados, mail-merge condicional,
        API/integrações e portal do cliente rico.
      </p>
      <Button type="submit" disabled={isPendingCheckout}>
        {isPendingCheckout ? "Abrindo checkout…" : "Assinar Plano Pro"}
      </Button>
      {stateCheckout.error && <p className="text-xs text-red-400 sm:ml-3">{stateCheckout.error}</p>}
    </form>
  );
}
