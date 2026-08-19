"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Label, Select, FieldError } from "@/components/ui/input";
import { gerarPeticaoDeModeloAction } from "@/app/app/fichas/actions";

export type ModeloParaSelecao = {
  id: string;
  nome: string;
  tipo: string | null;
};

const RÓTULO_VARIAVEL: Record<string, string> = {
  nome_cliente: "nome do cliente",
  numero_processo: "número do processo (CNJ)",
  area_direito: "área do direito",
  valor_causa: "valor da causa (contrato de honorário)",
  data_hoje: "data de hoje",
};

/**
 * Seção "Gerar petição a partir de modelo" na tela da ficha do caso: fluxo
 * de mail-merge jurídico (migration 0010) — o advogado escolhe um modelo já
 * cadastrado, a action resolve as variáveis contra os dados reais da ficha
 * aberta e devolve o texto pronto para copiar ou baixar. Fica na tela da
 * FICHA (não na tela do modelo) porque é o caso concreto que fornece os
 * dados de substituição; o modelo sozinho não tem cliente, processo nem
 * valor de causa para preencher `{{variavel}}`.
 */
export function GerarPeticaoCard({ fichaId, modelos }: { fichaId: string; modelos: ModeloParaSelecao[] }) {
  const [modeloSelecionadoId, setModeloSelecionadoId] = useState(modelos[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [textoGerado, setTextoGerado] = useState<string | null>(null);
  const [variaveisNaoResolvidas, setVariaveisNaoResolvidas] = useState<string[]>([]);
  const [copiado, setCopiado] = useState(false);

  function gerar() {
    if (!modeloSelecionadoId) {
      setErro("Selecione um modelo para gerar a petição.");
      return;
    }
    setErro(null);
    setCopiado(false);
    startTransition(async () => {
      const resultado = await gerarPeticaoDeModeloAction(fichaId, modeloSelecionadoId);
      if (!resultado.ok) {
        setErro(resultado.error);
        setTextoGerado(null);
        return;
      }
      setTextoGerado(resultado.textoFinal);
      setVariaveisNaoResolvidas(resultado.variaveisNaoResolvidas);
    });
  }

  async function copiar() {
    if (!textoGerado) return;
    try {
      await navigator.clipboard.writeText(textoGerado);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setErro("Não foi possível copiar automaticamente. Selecione o texto manualmente.");
    }
  }

  function baixar() {
    if (!textoGerado) return;
    const modelo = modelos.find((m) => m.id === modeloSelecionadoId);
    const nomeArquivo = `${(modelo?.nome ?? "peticao").replace(/[^\w\-À-ÿ ]/g, "").trim() || "peticao"}.txt`;
    const blob = new Blob([textoGerado], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardTitle className="mb-4">Gerar petição a partir de modelo</CardTitle>

      {modelos.length === 0 ? (
        <p className="text-sm text-muted">
          Nenhum modelo cadastrado ainda. Crie um modelo em &quot;Modelos&quot; com variáveis como{" "}
          <code className="rounded bg-white/10 px-1 py-0.5 text-xs">{"{{nome_cliente}}"}</code> para usar aqui.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[240px] flex-1">
              <Label htmlFor="modelo-peticao">Modelo</Label>
              <Select
                id="modelo-peticao"
                value={modeloSelecionadoId}
                onChange={(e) => setModeloSelecionadoId(e.target.value)}
              >
                {modelos.map((modelo) => (
                  <option key={modelo.id} value={modelo.id}>
                    {modelo.nome}
                    {modelo.tipo ? ` — ${modelo.tipo}` : ""}
                  </option>
                ))}
              </Select>
            </div>
            <Button onClick={gerar} disabled={isPending} size="sm">
              {isPending ? "Gerando…" : "Gerar petição"}
            </Button>
          </div>

          <FieldError>{erro}</FieldError>

          {textoGerado && (
            <div className="space-y-3">
              {variaveisNaoResolvidas.length > 0 && (
                <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-300">
                  Atenção: não foi possível preencher automaticamente{" "}
                  {variaveisNaoResolvidas
                    .map((v) => RÓTULO_VARIAVEL[v] ?? v)
                    .join(", ")}
                  . Revise o texto abaixo antes de usar — o placeholder original foi mantido no lugar.
                </p>
              )}

              <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-navy-2 p-4 text-sm leading-relaxed text-ice-2">
                {textoGerado}
              </pre>

              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="secondary" size="sm" onClick={copiar}>
                  {copiado ? "Copiado!" : "Copiar texto"}
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={baixar}>
                  Baixar (.txt)
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
