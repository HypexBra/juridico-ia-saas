"use client";

import { useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import type { ResultadoJurisprudencia } from "@/lib/jurisprudencia/busca";

type FormatarData = (iso: string | null) => string;

/**
 * Lista de resultados com seleção para o COMPARADOR DE DECISÕES (Fase 7):
 * o advogado marca até 3 decisões e vê a tabela lado a lado; a síntese da IA
 * (teses em comum, divergências, tendência) é feature Pro e carrega sob demanda.
 */
export function PesquisaResultados({
  resultados,
  formatarData,
}: {
  resultados: ResultadoJurisprudencia[];
  formatarData: FormatarData;
}) {
  const [selecionadas, setSelecionadas] = useState<ResultadoJurisprudencia[]>([]);
  const [expandida, setExpandida] = useState<string | null>(null);
  const [analise, setAnalise] = useState<{
    ok: boolean;
    error?: string;
    data?: {
      resumoComparativo: string;
      tesesEmComum: string[];
      divergencias: string[];
      tendencia: string;
      riscos: string[];
      recomendacao: string;
    };
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const idsSelecionadas = useMemo(() => new Set(selecionadas.map((r) => r.id)), [selecionadas]);

  function alternarSelecao(resultado: ResultadoJurisprudencia) {
    setAnalise(null);
    setSelecionadas((prev) => {
      if (prev.some((r) => r.id === resultado.id)) return prev.filter((r) => r.id !== resultado.id);
      if (prev.length >= 3) return prev;
      return [...prev, resultado];
    });
  }

  function comparar() {
    if (selecionadas.length < 2 || isPending) return;
    startTransition(async () => {
      const { compararDecisoesAction } = await import("@/app/app/pesquisa/actions");
      const resultado = await compararDecisoesAction({ ids: selecionadas.map((r) => r.id) });
      setAnalise(resultado.ok ? { ok: true, data: resultado.analise } : { ok: false, error: resultado.error });
    });
  }

  if (resultados.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="space-y-2.5">
        {resultados.map((resultado) => (
          <Card key={resultado.id} className="transition-colors hover:border-silver/30">
            <div className="flex items-start gap-3">
              <label className="mt-0.5 flex shrink-0 cursor-pointer items-center" title="Selecionar para comparar">
                <input
                  type="checkbox"
                  checked={idsSelecionadas.has(resultado.id)}
                  onChange={() => alternarSelecao(resultado)}
                  disabled={!idsSelecionadas.has(resultado.id) && selecionadas.length >= 3}
                  className="h-4 w-4 accent-silver"
                  aria-label={`Selecionar decisão ${resultado.numero_processo} para comparação`}
                />
              </label>
              <button
                type="button"
                onClick={() => setExpandida(expandida === resultado.id ? null : resultado.id)}
                className="min-w-0 flex-1 text-left"
                aria-expanded={expandida === resultado.id}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={resultado.tribunal === "stj" ? "silver" : "green"}>
                    {resultado.tribunal.toUpperCase()}
                  </Badge>
                  {resultado.classe ? <span className="text-xs text-muted">{resultado.classe}</span> : null}
                  <span className="font-mono text-xs text-silver-2">{resultado.numero_processo}</span>
                  <span className="ml-auto text-[10px] uppercase tracking-wide text-muted">
                    via {resultado.via === "lexical" ? "termo exato" : "semântica"}
                  </span>
                </div>
                <p className={`mt-1.5 text-sm text-silver-2 ${expandida === resultado.id ? "" : "line-clamp-2"}`}>
                  {resultado.ementa.slice(0, expandida === resultado.id ? 2000 : 240)}
                  {expandida === resultado.id && resultado.ementa.length > 2000 ? " […]" : ""}
                </p>
                <p className="mt-1.5 text-xs text-muted">
                  {resultado.orgao_julgador ?? "Órgão não informado"}
                  {resultado.relator ? ` · Rel. ${resultado.relator}` : ""}
                  {" · Julg. "}
                  {formatarData(resultado.data_julgamento)}
                  {resultado.tema ? ` · Tema ${resultado.tema}` : ""}
                </p>
              </button>
            </div>
          </Card>
        ))}
      </div>

      {/* Comparador */}
      <Card className={selecionadas.length > 0 ? "" : "opacity-60"}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm">
            Comparador de decisões ({selecionadas.length}/3 selecionadas)
          </CardTitle>
          <Button size="sm" onClick={comparar} disabled={selecionadas.length < 2 || isPending}>
            {isPending ? "Analisando…" : "Comparar com IA (Pro)"}
          </Button>
        </div>

        {selecionadas.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-xs">
              <tbody>
                {(
                  [
                    ["Tribunal", (r: ResultadoJurisprudencia) => r.tribunal.toUpperCase()],
                    ["Classe", (r: ResultadoJurisprudencia) => r.classe ?? "—"],
                    ["Nº processo", (r: ResultadoJurisprudencia) => r.numero_processo],
                    ["Relator", (r: ResultadoJurisprudencia) => r.relator ?? "—"],
                    ["Órgão", (r: ResultadoJurisprudencia) => r.orgao_julgador ?? "—"],
                    ["Julgamento", (r: ResultadoJurisprudencia) => formatarData(r.data_julgamento)],
                    ["Tema", (r: ResultadoJurisprudencia) => (r.tema ? `Tema ${r.tema}` : "—")],
                    [
                      "Origem",
                      (r: ResultadoJurisprudencia) =>
                        r.origem === "stj_dados_abertos" ? "STJ dados abertos" : "Cadastro interno",
                    ],
                  ] as [string, (r: ResultadoJurisprudencia) => string][]
                ).map(([rotulo, extrator]) => (
                  <tr key={rotulo} className="border-t border-ink/10">
                    <th scope="row" className="w-28 py-1.5 pr-2 font-medium text-muted">
                      {rotulo}
                    </th>
                    {selecionadas.map((r) => (
                      <td key={r.id} className="py-1.5 pr-4 text-silver-2">
                        {extrator(r)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted">
            Marque de duas a três decisões na lista acima. A tabela estruturada é livre; a síntese por IA é Pro.
          </p>
        )}

        {analise && !analise.ok ? (
          // Banner de erro claro (red-50/200) com texto vermelho escuro sobre papel.
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {analise.error}
          </p>
        ) : null}

        {analise?.ok && analise.data ? (
          <div className="mt-3 space-y-3 rounded-lg border border-ink/10 bg-navy-3/40 p-4 text-sm">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Resumo comparativo</p>
              <p className="mt-1 text-silver-2">{analise.data.resumoComparativo}</p>
            </div>
            {[
              ["Teses em comum", analise.data.tesesEmComum],
              ["Divergências", analise.data.divergencias],
              ["Riscos", analise.data.riscos],
            ].map(([rotulo, itens]) =>
              (itens as string[]).length > 0 ? (
                <div key={rotulo as string}>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">{rotulo}</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-silver-2">
                    {(itens as string[]).map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null,
            )}
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Tendência</p>
              <p className="mt-1 text-silver-2">{analise.data.tendencia}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Recomendação</p>
              <p className="mt-1 text-silver-2">{analise.data.recomendacao}</p>
            </div>
            <p className="text-[11px] text-muted">
              Análise assistida por IA com base apenas nas ementas fornecidas — hipótese de trabalho, não parecer jurídico. Valide antes de usar em peça.
            </p>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
