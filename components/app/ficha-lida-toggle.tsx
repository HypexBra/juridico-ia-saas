"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { marcarFichaLidaAction } from "@/app/app/fichas/actions";

export function FichaLidaToggle({ fichaId, lida }: { fichaId: string; lida: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="space-y-1">
      <Button
        variant="secondary"
        size="sm"
        disabled={isPending}
        onClick={() => {
          setErro(null);
          startTransition(async () => {
            const resultado = await marcarFichaLidaAction(fichaId, !lida);
            if (!resultado.ok) {
              setErro(resultado.error);
              return;
            }
            router.refresh();
          });
        }}
      >
        {lida ? "Marcar como não lida" : "Marcar como lida"}
      </Button>
      {erro && <p className="text-xs text-red-400">{erro}</p>}
    </div>
  );
}
