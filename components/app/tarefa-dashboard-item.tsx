"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { atualizarStatusTarefaCasoAction } from "@/app/app/fichas/[id]/tarefas-actions";
import { Badge } from "@/components/ui/badge";
import type { TarefaCaso } from "@/lib/types";

function formatarData(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function diasAte(iso: string) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(`${iso}T00:00:00`);
  return Math.ceil((alvo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

function toneDoPrazo(dias: number): "red" | "silver" | "muted" {
  if (dias < 0) return "red";
  if (dias <= 3) return "silver";
  return "muted";
}

/**
 * Item de tarefa no card "Minhas tarefas" do dashboard — nunca decorativo
 * (regra do projeto contra dashboard fake): o botão "Concluir" chama a MESMA
 * action já usada na ficha do caso (`tarefas-actions.ts`), não um mock.
 */
export function TarefaDashboardItem({ tarefa }: { tarefa: TarefaCaso }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function concluir() {
    startTransition(async () => {
      const resultado = await atualizarStatusTarefaCasoAction(tarefa.id, "concluida");
      if (resultado.ok) router.refresh();
    });
  }

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border-b border-ink/10 px-1 -mx-1 pb-3 last:border-0 last:pb-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ice">{tarefa.titulo}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted">
            {tarefa.status === "em_andamento" ? "Em andamento" : "Pendente"}
            {tarefa.prazo_opcional ? ` · até ${formatarData(tarefa.prazo_opcional)}` : ""}
          </span>
          {(tarefa.prioridade ?? "media") === "alta" ? (
            <Badge tone="red">Prioridade alta</Badge>
          ) : (tarefa.prioridade ?? "media") === "baixa" ? (
            <Badge tone="muted">Baixa</Badge>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {tarefa.prazo_opcional && (
          <Badge tone={toneDoPrazo(diasAte(tarefa.prazo_opcional))}>
            {diasAte(tarefa.prazo_opcional) < 0 ? "Atrasada" : `${diasAte(tarefa.prazo_opcional)}d`}
          </Badge>
        )}
        <button
          type="button"
          disabled={isPending}
          onClick={concluir}
          className="rounded-md border border-green/30 px-2 py-1 text-xs text-green hover:bg-green/10 disabled:opacity-50"
        >
          Concluir
        </button>
      </div>
    </li>
  );
}
