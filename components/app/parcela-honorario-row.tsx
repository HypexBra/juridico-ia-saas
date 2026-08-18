"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  marcarParcelaPagaAction,
  reverterPagamentoParcelaAction,
} from "@/app/app/financeiro/actions";
import type { ParcelaHonorario } from "@/lib/types";

function formatarData(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const STATUS_LABEL: Record<ParcelaHonorario["status"], string> = {
  pendente: "Pendente",
  pago: "Pago",
  atrasado: "Atrasado",
};

const STATUS_TONE: Record<ParcelaHonorario["status"], "gold" | "green" | "red"> = {
  pendente: "gold",
  pago: "green",
  atrasado: "red",
};

export function ParcelaHonorarioRow({ parcela }: { parcela: ParcelaHonorario }) {
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const router = useRouter();
  const atrasado = parcela.status === "atrasado";

  return (
    <li
      className={`flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-1 py-2.5 last:border-0 ${
        atrasado ? "bg-red-500/5" : ""
      }`}
    >
      <div className="flex min-w-0 flex-col">
        <span className="text-sm font-medium text-ice">
          Parcela {parcela.numero_parcela} · {formatarMoeda(parcela.valor)}
        </span>
        <span className="text-xs text-muted">
          Vencimento {formatarData(parcela.vencimento)}
          {parcela.pago_em ? ` · pago em ${formatarData(parcela.pago_em)}` : ""}
        </span>
        {erro && <span className="mt-1 text-xs text-red-400">{erro}</span>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge tone={STATUS_TONE[parcela.status]}>{STATUS_LABEL[parcela.status]}</Badge>
        {parcela.status === "pago" ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={() => {
              setErro(null);
              startTransition(async () => {
                const resultado = await reverterPagamentoParcelaAction(parcela.id);
                if (!resultado.ok) {
                  setErro(resultado.error);
                  return;
                }
                router.refresh();
              });
            }}
          >
            Desfazer
          </Button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isPending}
            onClick={() => {
              setErro(null);
              startTransition(async () => {
                const resultado = await marcarParcelaPagaAction(parcela.id);
                if (!resultado.ok) {
                  setErro(resultado.error);
                  return;
                }
                router.refresh();
              });
            }}
          >
            {isPending ? "Salvando…" : "Marcar como paga"}
          </Button>
        )}
      </div>
    </li>
  );
}
