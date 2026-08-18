"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  aprovarPropostaAction,
  buscarPropostaAction,
  rejeitarPropostaAction,
} from "@/app/app/chat/propostas-actions";
import type { PropostaAcao } from "@/lib/types";

const RÓTULO_TIPO: Record<PropostaAcao["tipo"], string> = {
  update_prazo: "Atualizar prazo",
  update_ficha: "Atualizar ficha de caso",
  create_prazo: "Criar prazo",
  create_ficha: "Criar ficha de caso",
  generate_documento: "Gerar documento",
};

const TONE_POR_STATUS = {
  pending: "gold",
  approved: "green",
  applied: "green",
  rejected: "red",
  failed: "red",
  expired: "muted",
} as const;

const RÓTULO_STATUS: Record<PropostaAcao["status"], string> = {
  pending: "Aguardando aprovação",
  approved: "Aprovada",
  applied: "Aplicada",
  rejected: "Rejeitada",
  failed: "Falhou ao aplicar",
  expired: "Expirada",
};

export function PropostaAcaoCard({ propostaId }: { propostaId: string }) {
  const [proposta, setProposta] = useState<PropostaAcao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelado = false;
    buscarPropostaAction(propostaId).then((p) => {
      if (!cancelado) setProposta(p);
    });
    return () => {
      cancelado = true;
    };
  }, [propostaId]);

  if (!proposta) return null;

  const payload = proposta.payload as Record<string, unknown>;
  const podeAgir = proposta.status === "pending";

  function agir(acao: "aprovar" | "rejeitar") {
    setErro(null);
    startTransition(async () => {
      const resultado = acao === "aprovar" ? await aprovarPropostaAction(proposta!.id) : await rejeitarPropostaAction(proposta!.id);
      if (!resultado.ok) {
        setErro(resultado.error);
        return;
      }
      const atualizada = await buscarPropostaAction(proposta!.id);
      setProposta(atualizada);
    });
  }

  return (
    <div className="mt-2 max-w-[85%] rounded-xl border border-gold/25 bg-navy-3/70 p-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gold-2">
          {RÓTULO_TIPO[proposta.tipo]}
        </span>
        <Badge tone={TONE_POR_STATUS[proposta.status]}>{RÓTULO_STATUS[proposta.status]}</Badge>
      </div>

      <p className="text-sm text-ice-2">{proposta.resumo}</p>

      {erro && <p className="mt-2 text-xs text-red-400">{erro}</p>}

      {podeAgir && (
        <div className="mt-3 flex gap-2">
          <Button type="button" size="sm" disabled={isPending} onClick={() => agir("aprovar")}>
            Aprovar
          </Button>
          <Button type="button" size="sm" variant="danger" disabled={isPending} onClick={() => agir("rejeitar")}>
            Rejeitar
          </Button>
        </div>
      )}

      {proposta.tipo === "generate_documento" && (proposta.status === "approved" || proposta.status === "applied") && (
        <a
          href={`/api/propostas/${proposta.id}/documento`}
          className="mt-3 inline-block text-sm font-medium text-gold-2 underline underline-offset-2"
        >
          Baixar {String(payload.formato ?? "docx").toUpperCase()}
        </a>
      )}
    </div>
  );
}
