"use client";

import { useState, useTransition } from "react";
import { cancelarConviteAction } from "@/app/app/equipe/actions";

export function CancelarConviteButton({ conviteId }: { conviteId: string }) {
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function cancelar() {
    if (!window.confirm("Cancelar este convite pendente?")) return;
    setErro(null);
    startTransition(async () => {
      const resultado = await cancelarConviteAction(conviteId);
      if (!resultado.ok) setErro(resultado.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={cancelar}
        className="rounded-md border border-red-500/30 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-50"
      >
        Cancelar
      </button>
      {erro && <p className="text-[11px] text-red-400">{erro}</p>}
    </div>
  );
}
