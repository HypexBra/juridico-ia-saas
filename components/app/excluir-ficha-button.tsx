"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { excluirFichaAction } from "@/app/app/fichas/actions";

export function ExcluirFichaButton({ fichaId }: { fichaId: string }) {
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      <Button
        variant="danger"
        size="sm"
        disabled={isPending}
        onClick={() => {
          if (!confirm("Excluir esta ficha definitivamente?")) return;
          setErro(null);
          startTransition(async () => {
            const resultado = await excluirFichaAction(fichaId);
            if (!resultado.ok) {
              setErro(resultado.error);
            }
          });
        }}
      >
        Excluir
      </Button>
      {erro && <p className="text-xs text-red-400">{erro}</p>}
    </div>
  );
}
