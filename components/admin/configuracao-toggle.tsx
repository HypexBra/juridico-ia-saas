"use client";

import { useState, useTransition } from "react";
import { atualizarConfiguracaoAction } from "@/app/admin/configuracoes/actions";

export function ConfiguracaoToggle({
  campo,
  valorInicial,
  label,
  descricao,
  confirmarAoAtivar,
}: {
  campo: "modo_manutencao" | "novos_cadastros_habilitados";
  valorInicial: boolean;
  label: string;
  descricao: string;
  confirmarAoAtivar?: string;
}) {
  const [valor, setValor] = useState(valorInicial);
  const [isPending, startTransition] = useTransition();
  const [mensagem, setMensagem] = useState<string | null>(null);

  function alternar() {
    const novoValor = !valor;
    if (novoValor && confirmarAoAtivar && !window.confirm(confirmarAoAtivar)) return;

    setMensagem(null);
    startTransition(async () => {
      const resultado = await atualizarConfiguracaoAction(campo, novoValor);
      if (!resultado.ok) {
        setMensagem(resultado.error);
        return;
      }
      setValor(novoValor);
      setMensagem(resultado.mensagem);
    });
  }

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium text-ice">{label}</p>
        <p className="text-xs text-muted">{descricao}</p>
        {mensagem && <p className="mt-1 text-[11px] text-muted">{mensagem}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={valor}
        disabled={isPending}
        onClick={alternar}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${valor ? "bg-green" : "bg-white/10"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${valor ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}
