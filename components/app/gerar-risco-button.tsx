"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { gerarRiscoAction } from "@/app/app/fichas/actions";

export function GerarRiscoButton({ fichaId, jaTemRisco }: { fichaId: string; jaTemRisco: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const router = useRouter();

  function gerar() {
    setErro(null);
    startTransition(async () => {
      const resultado = await gerarRiscoAction(fichaId);
      if (!resultado.ok) {
        setErro(resultado.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <Button onClick={gerar} disabled={isPending} size="sm" variant="secondary">
        {isPending ? "Calculando risco…" : jaTemRisco ? "Recalcular risco" : "Calcular risco do caso"}
      </Button>
      {erro && <p className="text-xs text-red-400">{erro}</p>}
    </div>
  );
}
