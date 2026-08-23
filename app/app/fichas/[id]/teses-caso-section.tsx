"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NovaTeseDialog } from "@/components/app/nova-tese-dialog";
import { atualizarStatusTeseAction } from "../actions";
import type { StatusTeseCaso, TeseCaso } from "@/lib/types";

const STATUS_LABEL: Record<StatusTeseCaso, string> = {
  em_avaliacao: "Em avaliação",
  adotada: "Adotada",
  descartada: "Descartada",
};

const STATUS_TONE: Record<StatusTeseCaso, "silver" | "green" | "red"> = {
  em_avaliacao: "silver",
  adotada: "green",
  descartada: "red",
};

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Histórico versionado de teses jurídicas do caso (`teses_caso`). Distinto
 * do resumo/estratégia de IA exibido em "Visão Geral" (texto livre gerado
 * pela análise) — aqui cada tese é uma entrada rastreável com status
 * (`em_avaliacao`/`adotada`/`descartada`) e histórico append-only de
 * mudanças.
 */
export function TesesCasoSection({
  fichaCasoId,
  tesesIniciais,
}: {
  fichaCasoId: string;
  tesesIniciais: TeseCaso[];
}) {
  const [teses, setTeses] = useState(tesesIniciais);
  const [erro, setErro] = useState<string | null>(null);
  const [pendenteId, setPendenteId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function mudarStatus(teseId: string, novoStatus: StatusTeseCaso) {
    setErro(null);
    setPendenteId(teseId);
    startTransition(async () => {
      const resultado = await atualizarStatusTeseAction(teseId, novoStatus);
      setPendenteId(null);
      if (!resultado.ok) {
        setErro(resultado.error);
        return;
      }
      setTeses((atual) => atual.map((t) => (t.id === teseId ? { ...t, status: novoStatus } : t)));
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-base font-semibold text-ice">Teses jurídicas ({teses.length})</h3>
        <NovaTeseDialog
          fichaCasoId={fichaCasoId}
          onCriada={(tese) => setTeses((atual) => [tese, ...atual])}
        />
      </div>

      {erro && <p className="text-xs text-red-700">{erro}</p>}

      {teses.length === 0 ? (
        <p className="text-sm text-muted">
          Nenhuma tese registrada ainda. Teses são geradas a partir da estratégia recomendada pela IA (aba
          &quot;Visão Geral&quot;) ou podem ser cadastradas manualmente conforme o caso evolui.
        </p>
      ) : (
        <ul className="space-y-3">
          {teses.map((tese) => {
            const isPending = pendenteId === tese.id;
            return (
              // Nota editorial: filete verde à esquerda marca a citação de tese.
              <li key={tese.id} className="rounded-lg border-l-2 border-accent bg-paper-2 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                      <Badge tone={STATUS_TONE[tese.status]}>{STATUS_LABEL[tese.status]}</Badge>
                      <span className="text-xs text-muted">Registrada em {formatarData(tese.criado_em)}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-ice-2">{tese.tese}</p>
                    {tese.fundamentacao && (
                      <p className="mt-1.5 whitespace-pre-wrap text-xs text-muted">{tese.fundamentacao}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {tese.status !== "adotada" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={isPending}
                        onClick={() => mudarStatus(tese.id, "adotada")}
                      >
                        Adotar
                      </Button>
                    )}
                    {tese.status !== "descartada" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isPending}
                        onClick={() => mudarStatus(tese.id, "descartada")}
                      >
                        Descartar
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
