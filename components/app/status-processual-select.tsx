"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { atualizarStatusProcessualAction } from "@/app/app/fichas/actions";
import type { StatusProcessualFicha } from "@/lib/types";

const OPCOES: { valor: StatusProcessualFicha; label: string }[] = [
  { valor: "em_andamento", label: "Em andamento" },
  { valor: "ganho", label: "Ganho" },
  { valor: "acordo", label: "Acordo homologado" },
  { valor: "perdido", label: "Perdido" },
  { valor: "arquivado", label: "Arquivado" },
];

export function StatusProcessualSelect({
  fichaId,
  statusProcessual,
}: {
  fichaId: string;
  statusProcessual: StatusProcessualFicha;
}) {
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const router = useRouter();

  function alterar(novoStatus: string) {
    setErro(null);
    startTransition(async () => {
      const resultado = await atualizarStatusProcessualAction(fichaId, novoStatus);
      if (!resultado.ok) {
        setErro(resultado.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-1">
      <label htmlFor={`status-processual-${fichaId}`} className="text-xs font-medium uppercase tracking-wide text-muted">
        Andamento do processo
      </label>
      <select
        id={`status-processual-${fichaId}`}
        value={statusProcessual}
        disabled={isPending}
        onChange={(evento) => alterar(evento.target.value)}
        className="block w-full max-w-xs rounded-md border border-white/10 bg-navy-3 px-3 py-2 text-sm text-ice focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-silver disabled:opacity-50"
      >
        {OPCOES.map((opcao) => (
          <option key={opcao.valor} value={opcao.valor}>
            {opcao.label}
          </option>
        ))}
      </select>
      {erro && <p className="text-xs text-red-400">{erro}</p>}
      <p className="text-xs text-muted">
        Usado na projeção de recebíveis de honorário de êxito: casos ganhos/com acordo confirmam a
        expectativa; casos perdidos/arquivados a zeram.
      </p>
    </div>
  );
}
