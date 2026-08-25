"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";

type Citacao = {
  tipo: "processo_cnj" | "numero_stj" | "sumula" | "tema";
  valor: string;
  status: "verificada" | "nao_verificada" | "mal_formada";
  detalhe?: {
    tribunal?: string;
    numeroProcesso?: string;
    classe?: string;
    relator?: string;
    orgaoJulgador?: string;
    dataJulgamento?: string | null;
    tese?: string | null;
    tema?: number | null;
  };
};

const ROTULO_TIPO: Record<Citacao["tipo"], string> = {
  processo_cnj: "Nº CNJ",
  numero_stj: "Nº STJ",
  sumula: "Súmula",
  tema: "Tema repetitivo",
};

/**
 * Verificador de citações (Fase 7): cole um texto (ex.: resposta da IA,
 * minuta de peça) e confira cada citação contra a base local de
 * jurisprudência. "Não verificada" ≠ falsa: só significa ausência na base.
 */
export function VerificarCitacoesForm() {
  const [texto, setTexto] = useState("");
  const [citacoes, setCitacoes] = useState<Citacao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function verificar() {
    if (isPending || texto.trim().length < 10) return;
    startTransition(async () => {
      const { verificarCitacoesAction } = await import("@/app/app/pesquisa/actions");
      const resultado = await verificarCitacoesAction({ texto });
      if (!resultado.ok) {
        setErro(resultado.error);
        setCitacoes(null);
        return;
      }
      setErro(null);
      setCitacoes(resultado.citacoes);
    });
  }

  return (
    <Card>
      <CardTitle className="text-sm">Verificar citações de um texto</CardTitle>
      <p className="mt-1 text-xs text-muted">
        Cole o texto e confira se as jurisprudências citadas existem na base local com os metadados oficiais.
      </p>
      <Textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={5}
        maxLength={60_000}
        placeholder="Cole aqui a resposta da IA, a minuta ou o trecho a conferir…"
        className="mt-3"
        aria-label="Texto a verificar"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted">{texto.length.toLocaleString("pt-BR")} / 60.000</span>
        <Button size="sm" onClick={verificar} disabled={isPending || texto.trim().length < 10}>
          {isPending ? "Verificando…" : "Verificar citações"}
        </Button>
      </div>

      {erro ? (
        // Banner de erro claro (red-50/200) com texto vermelho escuro sobre papel.
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>
      ) : null}

      {citacoes !== null && !isPending ? (
        citacoes.length === 0 ? (
          <p className="mt-3 text-xs text-muted">Nenhuma citação jurídica reconhecível no texto.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {citacoes.map((citacao) => (
              <li key={`${citacao.tipo}:${citacao.valor}`} className="rounded-lg border border-ink/10 bg-navy-3/40 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={citacao.status === "verificada" ? "green" : citacao.status === "mal_formada" ? "red" : "amber"}>
                    {citacao.status === "verificada" ? "Verificada" : citacao.status === "mal_formada" ? "Dígito inválido" : "Não verificada"}
                  </Badge>
                  <span className="text-xs uppercase tracking-wide text-muted">{ROTULO_TIPO[citacao.tipo]}</span>
                  <span className="font-mono text-xs text-silver-2">{citacao.valor}</span>
                </div>
                {citacao.status === "verificada" && citacao.detalhe ? (
                  <p className="mt-1 text-xs text-silver-2">
                    {[citacao.detalhe.tribunal, citacao.detalhe.classe, citacao.detalhe.orgaoJulgador, citacao.detalhe.relator ? `Rel. ${citacao.detalhe.relator}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                    {citacao.detalhe.dataJulgamento ? ` · Julg. ${citacao.detalhe.dataJulgamento.split("-").reverse().join("/")}` : ""}
                  </p>
                ) : null}
                {citacao.status === "nao_verificada" ? (
                  <p className="mt-1 text-xs text-muted">
                    Não encontrada na base local — confirme em fonte oficial antes de citar em peça.
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )
      ) : null}
    </Card>
  );
}
