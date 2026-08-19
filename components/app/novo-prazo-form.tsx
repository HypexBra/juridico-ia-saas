"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  criarPrazoAction,
  sugerirDataFinalPrazoAction,
  type CriarPrazoState,
} from "@/app/app/prazos/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea, FieldError } from "@/components/ui/input";
import type { ParteContrariaTipo } from "@/lib/types";

const INITIAL_STATE: CriarPrazoState = { error: null };

const PARTE_CONTRARIA_OPCOES: { value: ParteContrariaTipo; label: string }[] = [
  { value: "particular", label: "Particular (sem dobra)" },
  { value: "fazenda_publica", label: "Fazenda Pública (dobro — art. 183, CPC)" },
  { value: "ministerio_publico", label: "Ministério Público (dobro — art. 180, CPC)" },
  { value: "defensoria_publica", label: "Defensoria Pública (dobro — art. 186, CPC)" },
];

export function NovoPrazoForm() {
  const [state, formAction, isPending] = useActionState(criarPrazoAction, INITIAL_STATE);
  const formRef = useRef<HTMLFormElement>(null);

  // Calculadora de prazo: campos que alimentam a sugestão de data final.
  // `dataPrazo` fica controlada só para poder ser preenchida pela sugestão —
  // o usuário sempre pode digitar por cima, nunca fica travada/readOnly.
  const [dataIntimacao, setDataIntimacao] = useState("");
  const [diasUteis, setDiasUteis] = useState("");
  const [uf, setUf] = useState("");
  const [parteContrariaTipo, setParteContrariaTipo] = useState<ParteContrariaTipo>("particular");
  const [dataPrazo, setDataPrazo] = useState("");
  const [sugestaoInfo, setSugestaoInfo] = useState<string | null>(null);
  const [sugestaoErro, setSugestaoErro] = useState<string | null>(null);
  const [isCalculando, startCalculo] = useTransition();

  useEffect(() => {
    if (!isPending && !state.error) {
      formRef.current?.reset();
      startCalculo(() => {
        setDataIntimacao("");
        setDiasUteis("");
        setUf("");
        setParteContrariaTipo("particular");
        setDataPrazo("");
        setSugestaoInfo(null);
        setSugestaoErro(null);
      });
    }
  }, [isPending, state.error]);

  function calcularSugestao(overrides?: {
    dataIntimacao?: string;
    diasUteis?: string;
    uf?: string;
    parteContrariaTipo?: ParteContrariaTipo;
  }) {
    const valorDataIntimacao = overrides?.dataIntimacao ?? dataIntimacao;
    const valorDiasUteis = overrides?.diasUteis ?? diasUteis;
    const valorUf = overrides?.uf ?? uf;
    const valorParte = overrides?.parteContrariaTipo ?? parteContrariaTipo;

    const diasUteisNumero = Number(valorDiasUteis);
    if (!valorDataIntimacao || !valorDiasUteis || !Number.isFinite(diasUteisNumero) || diasUteisNumero <= 0) {
      return;
    }

    setSugestaoErro(null);
    startCalculo(async () => {
      const resultado = await sugerirDataFinalPrazoAction({
        dataIntimacao: valorDataIntimacao,
        diasUteis: diasUteisNumero,
        uf: valorUf.trim() ? valorUf.trim().toUpperCase() : null,
        parteContrariaTipo: valorParte,
      });

      if (!resultado.ok) {
        setSugestaoErro(resultado.error);
        setSugestaoInfo(null);
        return;
      }

      setDataPrazo(resultado.dataFinalISO);
      setSugestaoInfo(resultado.explicacao);
    });
  }

  return (
    <form ref={formRef} action={formAction} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <div>
          <Label htmlFor="titulo">Título</Label>
          <Input id="titulo" name="titulo" required placeholder="Ex: Contestação — Processo 0001234-56" />
        </div>
        <div>
          <Label htmlFor="dataPrazo">Data do prazo</Label>
          <Input
            id="dataPrazo"
            name="dataPrazo"
            type="date"
            required
            value={dataPrazo}
            onChange={(e) => setDataPrazo(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-navy/40 p-3.5">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">
          Calculadora de prazo (opcional — sugere a data acima, você pode ajustar)
        </p>
        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <Label htmlFor="dataIntimacao">Data da intimação</Label>
            <Input
              id="dataIntimacao"
              name="dataIntimacao"
              type="date"
              value={dataIntimacao}
              onChange={(e) => {
                setDataIntimacao(e.target.value);
                calcularSugestao({ dataIntimacao: e.target.value });
              }}
            />
          </div>
          <div>
            <Label htmlFor="diasUteis">Dias úteis do prazo</Label>
            <Input
              id="diasUteis"
              name="diasUteis"
              type="number"
              min={1}
              placeholder="Ex: 15"
              value={diasUteis}
              onChange={(e) => {
                setDiasUteis(e.target.value);
                calcularSugestao({ diasUteis: e.target.value });
              }}
            />
          </div>
          <div>
            <Label htmlFor="uf">UF do processo</Label>
            <Input
              id="uf"
              name="uf"
              maxLength={2}
              placeholder="Ex: SP"
              value={uf}
              onChange={(e) => {
                const valor = e.target.value.toUpperCase();
                setUf(valor);
                calcularSugestao({ uf: valor });
              }}
            />
          </div>
          <div>
            <Label htmlFor="parteContrariaTipo">Parte contrária</Label>
            <Select
              id="parteContrariaTipo"
              name="parteContrariaTipo"
              value={parteContrariaTipo}
              onChange={(e) => {
                const valor = e.target.value as ParteContrariaTipo;
                setParteContrariaTipo(valor);
                calcularSugestao({ parteContrariaTipo: valor });
              }}
            >
              {PARTE_CONTRARIA_OPCOES.map((opcao) => (
                <option key={opcao.value} value={opcao.value}>
                  {opcao.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {isCalculando && <p className="mt-2 text-xs text-muted">Calculando data sugerida…</p>}
        {!isCalculando && sugestaoInfo && <p className="mt-2 text-xs text-silver">{sugestaoInfo}</p>}
        {!isCalculando && sugestaoErro && <p className="mt-2 text-xs text-red-400">{sugestaoErro}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="processo">Processo (opcional)</Label>
          <Input id="processo" name="processo" placeholder="0001234-56.2026.8.26.0100" />
        </div>
        <div>
          <Label htmlFor="clienteNome">Cliente (opcional)</Label>
          <Input id="clienteNome" name="clienteNome" placeholder="Nome do cliente" />
        </div>
      </div>

      <div>
        <Label htmlFor="descricao">Descrição (opcional)</Label>
        <Textarea id="descricao" name="descricao" rows={2} placeholder="Detalhes adicionais do prazo" />
      </div>

      <FieldError>{state.error}</FieldError>

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando…" : "Adicionar prazo"}
        </Button>
      </div>
    </form>
  );
}
