"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Checkbox } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { ResultadoPrazoProcessual } from "@/lib/calculadoras/dias-uteis";
import { DetalhesLegais } from "./calculadora-atualizacao";
import { PRAZOS_DISPONIVEIS } from "@/lib/calculadoras/prescricao";

const dataBr = (iso: string) => iso.split("-").reverse().join("/");

/** Calculadora 3 — prazo processual em dias úteis (CPC arts. 219/224/220). */
export function CalculadoraPrazo() {
  const [dataPublicacao, setDataPublicacao] = useState("");
  const [unidade, setUnidade] = useState<"dias" | "meses" | "anos">("dias");
  const [quantidade, setQuantidade] = useState("15");
  const [emDobro, setEmDobro] = useState(false);
  const [considerarRecesso, setConsiderarRecesso] = useState(false);
  const [resultado, setResultado] = useState<ResultadoPrazoProcessual | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function calcular() {
    if (isPending || !dataPublicacao) return;
    startTransition(async () => {
      const { calcularPrazoProcessualAction } = await import("@/app/app/calculadoras/actions");
      const qtd = Number.parseInt(quantidade, 10) || 0;
      const resposta = await calcularPrazoProcessualAction({
        dataPublicacao,
        dias: unidade === "dias" ? qtd : null,
        meses: unidade === "meses" ? qtd : null,
        anos: unidade === "anos" ? qtd : null,
        emDobro,
        considerarRecesso,
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
      <CardTitle>Prazo processual (dias úteis + feriados nacionais)</CardTitle>
      <p className="mt-1 text-xs text-muted">
        CPC arts. 219 e 224: início no primeiro útil após a publicação; feriados nacionais fixos e móveis (Páscoa/Carnaval/Corpus Christi) calculados automaticamente.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="calc-pub">Data da publicação/intimação</Label>
          <Input id="calc-pub" type="date" value={dataPublicacao} onChange={(e) => setDataPublicacao(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="calc-unid">Unidade do prazo</Label>
          <Select id="calc-unid" value={unidade} onChange={(e) => setUnidade(e.target.value as typeof unidade)}>
            <option value="dias">Dias úteis (CPC)</option>
            <option value="meses">Meses (contínua)</option>
            <option value="anos">Anos (contínua)</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="calc-qtd">Quantidade</Label>
          <Input id="calc-qtd" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-xs text-silver-2">
          <Checkbox checked={emDobro} onChange={(e) => setEmDobro(e.target.checked)} />
          Prazo em dobro (arts. 183/186)
        </label>
        <label className="flex items-center gap-2 text-xs text-silver-2">
          <Checkbox checked={considerarRecesso} onChange={(e) => setConsiderarRecesso(e.target.checked)} />
          Considerar recesso forense 20/dez–20/jan (art. 220)
        </label>
      </div>

      <div className="mt-3">
        <Button size="sm" onClick={calcular} disabled={isPending || !dataPublicacao}>
          {isPending ? "Calculando…" : "Calcular vencimento"}
        </Button>
      </div>

      {erro ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>
      ) : null}

      {resultado ? (
        <div className="mt-4 space-y-2 rounded-lg border border-ink/10 bg-paper-2 p-4">
          <p className="text-sm text-silver-2">
            Início da contagem: <span className="font-bold text-ice tabular-nums">{dataBr(resultado.inicioContagem)}</span> ·
            VENCIMENTO: <span className="font-display font-bold text-ice tabular-nums">{dataBr(resultado.vencimento)}</span>
            {resultado.diasUteisEfetivos != null ? ` · ${resultado.diasUteisEfetivos} dias úteis` : ""}
          </p>
          {resultado.feriadosNoPeriodo.length > 0 ? (
            <p className="text-xs text-muted">
              Feriados no período: {resultado.feriadosNoPeriodo.map((f) => `${f.nome} (${dataBr(f.data)})`).join("; ")}.
            </p>
          ) : null}
          <DetalhesLegais premissas={resultado.premissas} />
        </div>
      ) : null}
    </Card>
  );
}

type ResultadoPrescricaoUI = {
  rotulo: string;
  dataFinal: string;
  diasRestantes: number;
  status: "prescrito" | "proximo" | "em_aberto";
  fundamento: string;
  premissas: string[];
};

/** Calculadora 4 — prescrição/decadência por tipo mais cobrado. */
export function CalculadoraPrescricao() {
  const [tipo, setTipo] = useState<string>(PRAZOS_DISPONIVEIS[0].id);
  const [termoInicial, setTermoInicial] = useState("");
  const [resultado, setResultado] = useState<ResultadoPrescricaoUI | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function calcular() {
    if (isPending || !termoInicial) return;
    startTransition(async () => {
      const { calcularPrescricaoAction } = await import("@/app/app/calculadoras/actions");
      const resposta = await calcularPrescricaoAction({ tipo, termoInicial });
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
      <CardTitle>Prescrição / decadência</CardTitle>
      <p className="mt-1 text-xs text-muted">
        Prazos mais cobrados no dia a dia com fundamento citado. Interrupção/suspensão dependem dos fatos — veja as premissas.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="calc-presc-tipo">Tipo de pretensão</Label>
          <Select id="calc-presc-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {PRAZOS_DISPONIVEIS.map((opcao) => (
              <option key={opcao.id} value={opcao.id}>
                {opcao.rotulo}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="calc-presc-dt">Termo inicial</Label>
          <Input id="calc-presc-dt" type="date" value={termoInicial} onChange={(e) => setTermoInicial(e.target.value)} />
        </div>
      </div>

      <div className="mt-3">
        <Button size="sm" onClick={calcular} disabled={isPending || !termoInicial}>
          {isPending ? "Calculando…" : "Verificar"}
        </Button>
      </div>

      {erro ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>
      ) : null}

      {resultado ? (
        <div className="mt-4 space-y-2 rounded-lg border border-ink/10 bg-paper-2 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={resultado.status === "prescrito" ? "red" : resultado.status === "proximo" ? "amber" : "green"}>
              {resultado.status === "prescrito"
                ? `Prescrito há ${Math.abs(resultado.diasRestantes).toLocaleString("pt-BR")} dias`
                : resultado.status === "proximo"
                  ? `ATENÇÃO: faltam ${resultado.diasRestantes.toLocaleString("pt-BR")} dias`
                  : `Em aberto — ${resultado.diasRestantes.toLocaleString("pt-BR")} dias restantes`}
            </Badge>
            <span className="text-sm text-silver-2">Termo final: {dataBr(resultado.dataFinal)}</span>
          </div>
          <DetalhesLegais premissas={resultado.premissas} />
        </div>
      ) : null}
    </Card>
  );
}
