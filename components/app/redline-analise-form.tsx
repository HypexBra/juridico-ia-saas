"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label, Input, Textarea, FieldError } from "@/components/ui/input";
import { analisarContratoAction } from "@/app/app/redline/actions";
import { RÓTULO_VEREDITO, type ResultadoAnaliseRisco, type VereditoClausula } from "@/lib/redline/tipos";

const VEREDITO_TONE: Record<VereditoClausula, "green" | "silver" | "red"> = {
  ok: "green",
  atencao: "silver",
  risco_alto: "red",
};

/**
 * Formulário + resultado da análise de risco contratual (redline). Só é
 * renderizado quando `temAcesso` é `true` — o upsell de plano free vive em
 * `app/app/redline/page.tsx` (página inteira é gated, ao contrário de
 * `RedacaoAssistidaCard`, que é um card dentro de uma página maior).
 */
export function RedlineAnaliseForm() {
  const [titulo, setTitulo] = useState("");
  const [textoContrato, setTextoContrato] = useState("");
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoAnaliseRisco | null>(null);

  function analisar() {
    setErro(null);
    startTransition(async () => {
      const resposta = await analisarContratoAction(titulo, textoContrato);
      if (!resposta.ok) {
        setErro(resposta.error);
        setResultado(null);
        return;
      }
      setResultado(resposta.resultado);
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle className="mb-4">Analisar contrato</CardTitle>

        <div className="space-y-4">
          <div>
            <Label htmlFor="redline-titulo">Título/identificação (opcional)</Label>
            <Input
              id="redline-titulo"
              placeholder="Ex: Contrato de prestação de serviços — Cliente X"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              disabled={isPending}
            />
          </div>

          <div>
            <Label htmlFor="redline-texto">Texto do contrato</Label>
            <Textarea
              id="redline-texto"
              rows={14}
              placeholder="Cole aqui o texto integral do contrato a ser analisado…"
              value={textoContrato}
              onChange={(e) => setTextoContrato(e.target.value)}
              disabled={isPending}
            />
            <p className="mt-1.5 text-xs text-muted">
              Esta primeira versão só aceita texto colado — envio de arquivo (.docx/.pdf) ainda não é suportado.
            </p>
          </div>

          <Button onClick={analisar} disabled={isPending || !textoContrato.trim()} size="sm">
            {isPending ? "Analisando contrato…" : "Analisar contrato"}
          </Button>

          <FieldError>{erro}</FieldError>
        </div>
      </Card>

      {resultado && (
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Resultado da análise</CardTitle>
            <Badge tone={resultado.quantidadeRiscoAlto > 0 ? "red" : "green"}>
              {resultado.quantidadeRiscoAlto > 0
                ? `${resultado.quantidadeRiscoAlto} cláusula(s) de risco alto`
                : "Nenhuma cláusula de risco alto"}
            </Badge>
          </div>

          <p className="mb-5 text-sm text-muted">{resultado.resumoGeral}</p>

          <div className="space-y-4">
            {resultado.clausulas.map((clausula) => (
              <div key={clausula.numero} className="rounded-lg border border-white/10 bg-navy-2 p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted">
                    Cláusula {clausula.numero}
                  </span>
                  <Badge tone={VEREDITO_TONE[clausula.veredito]}>{RÓTULO_VEREDITO[clausula.veredito]}</Badge>
                </div>

                <p className="text-sm leading-relaxed text-ice-2">{clausula.trechoOriginal}</p>

                {clausula.problema && (
                  <p className="mt-3 text-sm text-silver-2">
                    <span className="font-medium text-ice">Problema: </span>
                    {clausula.problema}
                  </p>
                )}

                {clausula.sugestao && (
                  <p className="mt-2 text-sm text-silver-2">
                    <span className="font-medium text-ice">Sugestão: </span>
                    {clausula.sugestao}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
