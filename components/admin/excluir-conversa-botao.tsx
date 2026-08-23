"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { excluirConversaAdminAction } from "@/app/admin/conversas/actions";

export function ExcluirConversaBotao({ conversaId, aposExcluirVoltar = false }: { conversaId: string; aposExcluirVoltar?: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [mensagem, setMensagem] = useState<string | null>(null);
  const router = useRouter();

  function excluir() {
    if (!window.confirm("Excluir esta conversa em nome do usuário? Essa ação não pode ser desfeita.")) return;
    setMensagem(null);
    startTransition(async () => {
      const resultado = await excluirConversaAdminAction(conversaId);
      if (!resultado.ok) {
        setMensagem(resultado.error);
        return;
      }
      if (aposExcluirVoltar) {
        router.push("/admin/conversas");
      } else {
        setMensagem(resultado.mensagem);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={excluir}
        className="rounded-md border border-red-700/30 px-2 py-1 text-xs text-red-700 hover:bg-red-700/10 disabled:opacity-50"
      >
        Excluir conversa
      </button>
      {mensagem && <p className="text-[11px] text-muted">{mensagem}</p>}
    </div>
  );
}
