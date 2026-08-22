"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type DadosExtraidos = {
  valorOriginal: number;
  valorOriginalTrecho: string;
  dataInicial: string;
  dataInicialTrecho: string;
  dataFinal: string;
  dataFinalTrecho: string;
  indiceSugerido: string;
  indiceTrecho: string;
  jurosPercentualMensal: number;
  jurosTrecho: string;
  tipoJuros: string;
  observacoes: string[];
};

/**
 * Extração assistida (Pro) — cole o trecho da sentença/acordo e a IA
 * preenche os campos da Calculadora de atualização. CADA campo exibido vem
 * com o trecho literal que o sustenta: a conferência humana é parte do
 * fluxo, não opcional. Nada é calculado aqui — só preenchimento do form.
 */
export function ExtracaoSentenca({
  aoAplicar,
}: {
  aoAplicar: (dados: {
    valorOriginalTexto: string;
    dataInicial: string;
    dataFinal: string;
    indice: "ipca" | "selic";
    jurosMensalTexto: string;
    tipoJuros: "simples" | "compostos";
  }) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [extraidos, setExtraidos] = useState<DadosExtraidos | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function extrair() {
    if (isPending || texto.trim().length < 50) return;
    startTransition(async () => {
      const { extrairDadosSentencaAction } = await import("@/app/app/calculadoras/actions");
      const resposta = await extrairDadosSentencaAction({ texto });
      if (!resposta.ok) {
        setErro(resposta.error);
        setExtraidos(null);
        return;
      }
      setErro(null);
      setExtraidos(resposta.resultado);
    });
  }

  function aplicar() {
    if (!extraidos) return;
    const indiceNormalizado =
      extraidos.indiceSugerido.includes("ipca") ? "ipca" : extraidos.indiceSugerido.includes("selic") ? "selic" : "ipca";
    aoAplicar({
      valorOriginalTexto: String(extraidos.valorOriginal).replace(".", ","),
      dataInicial: extraidos.dataInicial,
      dataFinal: extraidos.dataFinal || new Date().toISOString().slice(0, 10),
      indice: indiceNormalizado,
      jurosMensalTexto: String(extraidos.jurosPercentualMensal),
      tipoJuros: extraidos.tipoJuros === "compostos" ? "compostos" : "simples",
    });
    setAberto(false);
    setExtraidos(null);
    setTexto("");
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="text-xs text-silver-2 underline underline-offset-2 hover:text-ice"
      >
        Extrair dados de uma sentença com IA (Pro)
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-white/10 bg-navy/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-silver-2">Cole o trecho da sentença, acordo ou contrato</p>
        <button type="button" onClick={() => setAberto(false)} className="text-xs text-muted hover:text-silver-2" aria-label="Fechar extração">
          fechar
        </button>
      </div>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={5}
        maxLength={60_000}
        placeholder='Ex.: "...condenar a ré a pagar R$ 25.000,00, corrigidos pelo IPCA desde o evento (12/03/2024), com juros de mora de 1% ao mês..."'
        className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-navy-2 px-3 py-2 text-xs text-ice placeholder:text-muted/70 outline-none focus:border-silver/50"
        aria-label="Texto para extração"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] text-muted">{texto.length.toLocaleString("pt-BR")} / 60.000</span>
        <Button size="sm" onClick={extrair} disabled={isPending || texto.trim().length < 50}>
          {isPending ? "Extraindo…" : "Extrair parâmetros"}
        </Button>
      </div>

      {erro ? (
        <p className="mt-2 rounded-lg border border-red-500/25 bg-red-950/20 px-3 py-2 text-xs text-red-300">{erro}</p>
      ) : null}

      {extraidos ? (
        <div className="mt-3 space-y-2">
          {(
            [
              ["Valor", `R$ ${extraidos.valorOriginal.toLocaleString("pt-BR")}`, extraidos.valorOriginalTrecho],
              ["Data inicial", extraidos.dataInicial ? extraidos.dataInicial.split("-").reverse().join("/") : "(ausente)", extraidos.dataInicialTrecho],
              ["Índice", extraidos.indiceSugerido.toUpperCase(), extraidos.indiceTrecho],
              ["Juros", `${extraidos.jurosPercentualMensal}% a.m. (${extraidos.tipoJuros})`, extraidos.jurosTrecho],
            ] as const
          ).map(([rotulo, valor, trecho]) => (
            <div key={rotulo} className="rounded border border-white/5 bg-navy-3/40 px-2.5 py-1.5">
              <div className="flex items-center gap-2">
                <Badge tone="silver">{rotulo}</Badge>
                <span className="text-xs font-medium text-ice">{valor}</span>
              </div>
              {trecho ? (
                <p className="mt-0.5 line-clamp-2 text-[11px] italic text-muted">“{trecho}”</p>
              ) : (
                <p className="mt-0.5 text-[11px] text-muted">Sem lastro no texto informado.</p>
              )}
            </div>
          ))}
          {extraidos.observacoes.length > 0 ? (
            <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-muted">
              {extraidos.observacoes.map((obs, i) => (
                <li key={i}>{obs}</li>
              ))}
            </ul>
          ) : null}
          <Button size="sm" onClick={aplicar} disabled={!extraidos.valorOriginal}>
            Preencher a calculadora (confira os trechos antes)
          </Button>
        </div>
      ) : null}
    </div>
  );
}
