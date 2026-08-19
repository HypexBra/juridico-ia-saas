import { Badge } from "@/components/ui/badge";
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

/** Visão somente-leitura de um prazo, para o portal do cliente — sem
 * checkbox de conclusão nem botão de excluir (ver `PrazoRow` em
 * `components/app` para o equivalente editável, usado pelo advogado). */
export function PrazoViewRow({ prazo }: { prazo: Prazo }) {
  const dias = diasAte(prazo.data_prazo);

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 border-b border-white/5 py-3 last:border-0">
      <div className="min-w-0">
        <p className={`text-sm font-medium ${prazo.concluido ? "text-muted line-through" : "text-ice"}`}>
          {prazo.titulo}
        </p>
        <p className="text-xs text-muted">
          {formatarData(prazo.data_prazo)}
          {prazo.processo ? ` · ${prazo.processo}` : ""}
        </p>
        {prazo.descricao && <p className="mt-1 text-xs text-muted">{prazo.descricao}</p>}
      </div>
      <div className="shrink-0">
        {prazo.concluido ? (
          <Badge tone="green">Concluído</Badge>
        ) : (
          <Badge tone={urgenciaTone(dias)}>{dias < 0 ? "Vencido" : `${dias}d`}</Badge>
        )}
      </div>
    </li>
  );
}
