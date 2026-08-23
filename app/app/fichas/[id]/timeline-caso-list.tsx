import { Badge } from "@/components/ui/badge";
import type { EventoCaso, OrigemEventoCaso } from "@/lib/types";

const ORIGEM_LABEL: Record<OrigemEventoCaso, string> = {
  manual: "Manual",
  ia: "IA",
  djen: "DJEN",
  documento: "Documento",
};

const ORIGEM_TONE: Record<OrigemEventoCaso, "silver" | "green" | "blue" | "muted"> = {
  manual: "silver",
  ia: "green",
  djen: "blue",
  documento: "muted",
};

function formatarDataEvento(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Linha do tempo do caso (`eventos_caso`, append-only) — puramente
 * apresentacional, sem estado/interatividade, então fica como Server
 * Component (nenhum `"use client"` necessário). Os eventos já chegam
 * ordenados (`data_evento desc`) por `listarEventosCasoAction`.
 */
export function TimelineCasoList({ eventos }: { eventos: EventoCaso[] }) {
  if (eventos.length === 0) {
    return (
      <p className="text-sm text-muted">
        Nenhum evento registrado ainda. A linha do tempo é preenchida automaticamente quando prazos, petições e
        assinaturas do caso avançam — ou pode ser complementada manualmente.
      </p>
    );
  }

  return (
    <ol className="relative space-y-5 border-l border-ink/15 pl-5">
      {eventos.map((evento) => (
        <li key={evento.id} className="relative">
          <span className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full border-2 border-navy-2 bg-silver" />
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-ice">{evento.tipo_evento}</p>
            <Badge tone={ORIGEM_TONE[evento.origem]}>{ORIGEM_LABEL[evento.origem]}</Badge>
          </div>
          {/* Data em mono — convenção editorial de linha do tempo. */}
          <p className="mt-0.5 font-mono text-xs text-muted">{formatarDataEvento(evento.data_evento)}</p>
          <p className="mt-1 text-sm text-ice-2">{evento.descricao}</p>
        </li>
      ))}
    </ol>
  );
}
