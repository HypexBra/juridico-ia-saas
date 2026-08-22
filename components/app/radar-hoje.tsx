"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import type { SinalRadar } from "@/lib/radar/radar";

const SEVERIDADE_TONE: Record<SinalRadar["severidade"], "red" | "amber" | "silver"> = {
  alta: "red",
  media: "amber",
  baixa: "silver",
};

type Briefing = { resumo: string; prioridades: string[]; recomendacoes: string[] };

/**
 * Central "O que preciso saber hoje?" — Fase 11 (IA Proativa). Os sinais
 * chegam determinísticos do servidor; o briefing IA é gerado sob demanda
 * (botão) com fallback determinístico se a IA falhar.
 */
export function RadarHoje({ sinaisIniciais }: { sinaisIniciais: SinalRadar[] }) {
  const [sinais] = useState(sinaisIniciais);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function gerar() {
    if (isPending) return;
    startTransition(async () => {
      const { gerarBriefingRadarAction } = await import("@/app/app/dashboard/radar-actions");
      const resultado = await gerarBriefingRadarAction();
      if (!resultado.ok) {
        setErro(resultado.error);
        return;
      }
      setErro(null);
      setBriefing(resultado.briefing);
    });
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>O que preciso saber hoje</CardTitle>
        <Button size="sm" variant="ghost" onClick={gerar} disabled={isPending}>
          {isPending ? "Analisando…" : briefing ? "Atualizar briefing IA" : "Briefing com IA"}
        </Button>
      </div>

      {sinais.length === 0 && !briefing ? (
        <p className="mt-2 text-sm text-muted">
          Nenhum alerta agora — prazos em dia, tarefas sem atraso, comunicação em ordem.
        </p>
      ) : null}

      {sinais.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {sinais.map((sinal) => {
            const conteudo = (
              <>
                <Badge tone={SEVERIDADE_TONE[sinal.severidade]}>
                  {sinal.severidade === "alta" ? "Urgente" : sinal.severidade === "media" ? "Atenção" : "Info"}
                </Badge>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ice">{sinal.titulo}</span>
                  <span className="block text-xs text-muted">{sinal.detalhe}</span>
                </span>
              </>
            );
            return (
              <li key={sinal.codigo}>
                {sinal.href ? (
                  <Link
                    href={sinal.href}
                    className="flex items-start gap-2.5 rounded-lg border border-white/5 bg-navy-3/40 px-3 py-2.5 transition-transform duration-150 ease-out active:scale-[0.98] hover:border-silver/25"
                  >
                    {conteudo}
                  </Link>
                ) : (
                  <div className="flex items-start gap-2.5 px-3 py-2.5">{conteudo}</div>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}

      {briefing ? (
        <div className="mt-4 space-y-3 rounded-lg border border-white/10 bg-navy-3/40 p-4">
          <p className="text-sm text-silver-2">{briefing.resumo}</p>
          {briefing.prioridades.length > 0 ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Prioridades de hoje</p>
              <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-silver-2">
                {briefing.prioridades.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ol>
            </div>
          ) : null}
          {briefing.recomendacoes.length > 0 ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Recomendações</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-silver-2">
                {briefing.recomendacoes.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="text-[11px] text-muted">
            Síntese por IA sobre sinais reais do banco — confirme cada item antes de agir.
          </p>
        </div>
      ) : null}

      {erro ? (
        <p className="mt-3 rounded-lg border border-red-500/25 bg-red-950/20 px-3 py-2 text-xs text-red-300">{erro}</p>
      ) : null}
    </Card>
  );
}
