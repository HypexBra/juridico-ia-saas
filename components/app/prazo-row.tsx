"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { concluirPrazoAction, excluirPrazoAction } from "@/app/app/prazos/actions";
import type { Prazo } from "@/lib/types";

function formatarData(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function diasAte(iso: string) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(`${iso}T00:00:00`);
  return Math.ceil((alvo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

function urgenciaTone(dias: number): "red" | "silver" | "green" {
  if (dias <= 1) return "red";
  if (dias <= 7) return "silver";
  return "green";
}

export function PrazoRow({ prazo }: { prazo: Prazo }) {
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const router = useRouter();
  const dias = diasAte(prazo.data_prazo);

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 border-b border-white/5 py-3 last:border-0">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={prazo.concluido}
          disabled={isPending}
          onChange={() => {
            setErro(null);
            startTransition(async () => {
              const resultado = await concluirPrazoAction(prazo.id, !prazo.concluido);
              if (!resultado.ok) {
                setErro(resultado.error);
                return;
              }
              router.refresh();
            });
          }}
          className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-silver"
          aria-label={prazo.concluido ? "Marcar como pendente" : "Marcar como concluído"}
        />
        <div>
          <p className={`text-sm font-medium ${prazo.concluido ? "text-muted line-through" : "text-ice"}`}>
            {prazo.titulo}
          </p>
          <p className="text-xs text-muted">
            {formatarData(prazo.data_prazo)}
            {prazo.cliente_nome ? ` · ${prazo.cliente_nome}` : ""}
            {prazo.processo ? ` · ${prazo.processo}` : ""}
          </p>
          {(prazo.numero_processo_cnj || prazo.tribunal) && (
            <p className="mt-1 text-xs text-muted">
              {prazo.numero_processo_cnj ? `Processo CNJ: ${prazo.numero_processo_cnj}` : ""}
              {prazo.numero_processo_cnj && prazo.tribunal ? " · " : ""}
              {prazo.tribunal ? `Tribunal: ${prazo.tribunal}` : ""}
            </p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {prazo.origem === "djen" && <Badge tone="blue">Importado via DJEN</Badge>}
            {prazo.origem === "importado" && <Badge tone="muted">Importado</Badge>}
            {prazo.prazo_em_dobro && (
              <Badge tone="silver">
                Prazo em dobro
                {prazo.parte_contraria_tipo !== "particular"
                  ? ` · ${
                      {
                        fazenda_publica: "Fazenda Pública",
                        ministerio_publico: "Ministério Público",
                        defensoria_publica: "Defensoria Pública",
                      }[prazo.parte_contraria_tipo]
                    }`
                  : ""}
              </Badge>
            )}
            {prazo.uf && <Badge tone="muted">UF: {prazo.uf}</Badge>}
          </div>
          {prazo.descricao && <p className="mt-1 text-xs text-muted">{prazo.descricao}</p>}
          {erro && <p className="mt-1 text-xs text-red-400">{erro}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {!prazo.concluido && <Badge tone={urgenciaTone(dias)}>{dias < 0 ? "Vencido" : `${dias}d`}</Badge>}
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            if (!confirm("Excluir este prazo?")) return;
            setErro(null);
            startTransition(async () => {
              const resultado = await excluirPrazoAction(prazo.id);
              if (!resultado.ok) {
                setErro(resultado.error);
                return;
              }
              router.refresh();
            });
          }}
          className="cursor-pointer rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-red-950/40 hover:text-red-300 disabled:opacity-40"
        >
          Excluir
        </button>
      </div>
    </li>
  );
}
