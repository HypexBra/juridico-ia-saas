"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Checkbox } from "@/components/ui/input";
import type { ResultadoSucumbenciais } from "@/lib/calculadoras/honorarios-sucumbenciais";
import { DetalhesLegais } from "./calculadora-atualizacao";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Calculadora 2 — honorários sucumbenciais progressivos do art. 85 CPC. */
export function CalculadoraSucumbenciais() {
  const [valorCondenacao, setValorCondenacao] = useState("");
  const [salarioMinimo, setSalarioMinimo] = useState("1518");
  const [recursal, setRecursal] = useState(false);
  const [resultado, setResultado] = useState<ResultadoSucumbenciais | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function parseValor(texto: string): number {
    return Number.parseFloat(texto.replace(/\./g, "").replace(",", ".")) || 0;
  }

  function calcular() {
    if (isPending) return;
    startTransition(async () => {
      const { calcularSucumbenciaisAction } = await import("@/app/app/calculadoras/actions");
      const resposta = await calcularSucumbenciaisAction({
        valorCondenacao: parseValor(valorCondenacao),
        salarioMinimo: parseValor(salarioMinimo),
        aplicarRecursal: recursal,
      });
      if (!resposta.ok) {
        setErro(resposta.error ?? "Erro no cálculo.");
        setResultado(null);
        return;
      }
      setErro(null);
      setResultado(resposta.resultado);
    });
  }

  return (
    <Card>
      <CardTitle>Honorários sucumbenciais — art. 85 §5º CPC</CardTitle>
      <p className="mt-1 text-xs text-muted">
        Faixas progressivas em URM (salário mínimo), como no modelo do IR — o erro clássico é aplicar a taxa da última faixa no valor inteiro.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="calc-cond">Valor da condenação / proveito econômico (R$)</Label>
          <Input id="calc-cond" value={valorCondenacao} onChange={(e) => setValorCondenacao(e.target.value)} placeholder="150.000,00" />
        </div>
        <div>
          <Label htmlFor="calc-sm">Salário mínimo vigente à data do pagamento (R$)</Label>
          <Input id="calc-sm" value={salarioMinimo} onChange={(e) => setSalarioMinimo(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-silver-2">
          <Checkbox checked={recursal} onChange={(e) => setRecursal(e.target.checked)} />
          Incluir sucumbência recursal (art. 85 §11 — 50%)
        </label>
      </div>

      <div className="mt-3">
        <Button size="sm" onClick={calcular} disabled={isPending}>
          {isPending ? "Calculando…" : "Calcular"}
        </Button>
      </div>

      {erro ? (
        <p className="mt-3 rounded-lg border border-red-500/25 bg-red-950/20 px-3 py-2 text-xs text-red-300">{erro}</p>
      ) : null}

      {resultado ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-silver/30 bg-silver/10 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted">Honorários ({resultado.percentualEfetivo}% efetivo sobre {resultado.salariosMinimosReferencia.toLocaleString("pt-BR")} URM)</p>
            <p className="font-display text-lg font-bold text-ice">{brl(resultado.totalHonorarios)}</p>
            {resultado.sucumbenciaRecursal != null ? (
              <p className="text-xs text-silver-2">+ recursal: {brl(resultado.sucumbenciaRecursal)}</p>
            ) : null}
          </div>

          <table className="w-full text-left text-xs">
            <thead className="text-muted">
              <tr>
                <th className="py-1">Faixa</th>
                <th>Base na faixa</th>
                <th>%</th>
                <th>Honorários</th>
              </tr>
            </thead>
            <tbody className="text-silver-2">
              {resultado.linhasPorFaixa.map((linha) => (
                <tr key={linha.faixa} className="border-t border-white/5">
                  <td className="py-1">{linha.faixa}</td>
                  <td>{brl(linha.baseNaFaixa)}</td>
                  <td>{linha.percentual}%</td>
                  <td>{brl(linha.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <DetalhesLegais premissas={resultado.premissas} fontes={resultado.formulas} />
        </div>
      ) : null}
    </Card>
  );
}
