"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import type { ResultadoAtualizacao } from "@/lib/calculadoras/atualizacao-monetaria";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Calculadora 1 — atualização monetária + juros com índice oficial do BC. */
export function CalculadoraAtualizacao() {
  const [valor, setValor] = useState("10.000,00");
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState(new Date().toISOString().slice(0, 10));
  const [indice, setIndice] = useState<"ipca" | "selic">("ipca");
  const [jurosMensal, setJurosMensal] = useState("1");
  const [tipoJuros, setTipoJuros] = useState<"simples" | "compostos">("simples");
  const [multaPct, setMultaPct] = useState("0");
  const [honorariosPct, setHonorariosPct] = useState("0");
  const [resultado, setResultado] = useState<ResultadoAtualizacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function parseValor(texto: string): number {
    return Number.parseFloat(texto.replace(/\./g, "").replace(",", ".")) || 0;
  }

  function calcular() {
    if (isPending) return;
    startTransition(async () => {
      const { calcularAtualizacaoAction } = await import("@/app/app/calculadoras/actions");
      const resposta = await calcularAtualizacaoAction({
        valorOriginal: parseValor(valor),
        dataInicial,
        dataFinal,
        indice,
        taxaJurosMensalPercentual: Number.parseFloat(jurosMensal.replace(",", ".")) || 0,
        tipoJuros,
        multaPercentual: Number.parseFloat(multaPct.replace(",", ".")) || 0,
        honorariosPercentual: Number.parseFloat(honorariosPct.replace(",", ".")) || 0,
      });
      if (!resposta.ok) {
        setErro(resposta.error);
        setResultado(null);
        return;
      }
      setErro(null);
      setResultado(resposta.resultado);
    });
  }

  return (
    <Card>
      <CardTitle>Atualização monetária + juros</CardTitle>
      <p className="mt-1 text-xs text-muted">
        Índice oficial buscado em tempo real na API do Banco Central (IPCA série 433 ou SELIC mensal série 16122).
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label htmlFor="calc-valor">Valor original (R$)</Label>
          <Input id="calc-valor" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="10.000,00" />
        </div>
        <div>
          <Label htmlFor="calc-dti">Data do débito</Label>
          <Input id="calc-dti" type="date" value={dataInicial} onChange={(e) => setDataInicial(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="calc-dtf">Data do cálculo</Label>
          <Input id="calc-dtf" type="date" value={dataFinal} onChange={(e) => setDataFinal(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="calc-indice">Índice de correção</Label>
          <Select id="calc-indice" value={indice} onChange={(e) => setIndice(e.target.value as typeof indice)}>
            <option value="ipca">IPCA (legal default)</option>
            <option value="selic">SELIC mensal</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="calc-juros">Juros % a.m.</Label>
          <Input id="calc-juros" value={jurosMensal} onChange={(e) => setJurosMensal(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="calc-tipoj">Regime de juros</Label>
          <Select id="calc-tipoj" value={tipoJuros} onChange={(e) => setTipoJuros(e.target.value as typeof tipoJuros)}>
            <option value="simples">Simples</option>
            <option value="compostos">Compostos</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="calc-multa">Multa % (opcional)</Label>
          <Input id="calc-multa" value={multaPct} onChange={(e) => setMultaPct(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="calc-hon">Honorários contratuais % (opcional)</Label>
          <Input id="calc-hon" value={honorariosPct} onChange={(e) => setHonorariosPct(e.target.value)} />
        </div>
      </div>

      <div className="mt-3">
        <Button size="sm" onClick={calcular} disabled={isPending || !dataInicial || !dataFinal}>
          {isPending ? "Calculando com índices oficiais…" : "Calcular"}
        </Button>
      </div>

      {erro ? (
        <p className="mt-3 rounded-lg border border-red-500/25 bg-red-950/20 px-3 py-2 text-xs text-red-300">{erro}</p>
      ) : null}

      {resultado ? (
        <div className="mt-4 space-y-3">
          <div className="grid gap-2 sm:grid-cols-[repeat(auto-fit,minmax(140px,1fr))]">
            {[
              ["Principal corrigido", brl(resultado.valorCorrigido)],
              ["Juros", brl(resultado.juros)],
              ...(resultado.multa > 0 ? [["Multa", brl(resultado.multa)] as const] : []),
              ...(resultado.honorarios > 0 ? [["Honorários", brl(resultado.honorarios)] as const] : []),
            ].map(([rotulo, valor]) => (
              <div key={rotulo} className="rounded-lg border border-white/10 bg-navy-3/40 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted">{rotulo}</p>
                <p className="font-display text-sm font-bold text-ice">{valor}</p>
              </div>
            ))}
            <div className="rounded-lg border border-silver/30 bg-silver/10 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted">TOTAL</p>
              <p className="font-display text-sm font-bold text-ice">{brl(resultado.total)}</p>
            </div>
          </div>

          <details className="rounded-lg border border-white/10 bg-navy/40 p-3 text-xs">
            <summary className="cursor-pointer font-medium text-silver-2">Fórmula e demonstrativo ({resultado.mesesCorrigidos} meses corrigidos · {resultado.diasJuros} dias de juros)</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
              {resultado.formulas.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
            {resultado.demonstrativo.length > 0 ? (
              <table className="mt-2 w-full text-left text-[11px]">
                <thead>
                  <tr className="text-muted">
                    <th className="py-1">Mês</th>
                    <th>Fator</th>
                    <th>Acumulado</th>
                  </tr>
                </thead>
                <tbody className="text-silver-2">
                  {resultado.demonstrativo.map((linha) => (
                    <tr key={linha.anoMes}>
                      <td className="py-0.5">{linha.anoMes.split("-").reverse().join("/")}</td>
                      <td>{linha.fatorAplicado.toLocaleString("pt-BR")}</td>
                      <td>{brl(linha.valorAcumulado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </details>

          <DetalhesLegais premissas={resultado.premissas} fontes={resultado.fontes} />
        </div>
      ) : null}
    </Card>
  );
}

export function DetalhesLegais({ premissas, fontes }: { premissas: string[]; fontes?: string[] }) {
  return (
    <div className="space-y-1.5 text-[11px] text-muted">
      <p>
        <span className="font-medium text-silver-2">Premissas:</span> {premissas.join(" ")}
      </p>
      {fontes && fontes.length > 0 ? (
        <p>
          <span className="font-medium text-silver-2">Fontes:</span> {fontes.join(" ")}
        </p>
      ) : null}
    </div>
  );
}
