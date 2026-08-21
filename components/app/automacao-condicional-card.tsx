"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Label, Select, FieldError } from "@/components/ui/input";
import {
  gerarDocumentoCondicionalAction,
  type ModeloCondicional,
} from "@/app/app/fichas/[id]/mail-merge-condicional-actions";

/**
 * "Automação de documento com lógica condicional (Pro)": evolução do
 * mail-merge 1-clique de `GerarPeticaoCard` (petição por modelo, plano
 * free, só substitui `{{variavel}}` literal). Aqui o modelo pode ter blocos
 * `{{#se ...}}`/`{{#cada ...}}` (ver `lib/mailmerge-condicional/motor.ts`
 * para a sintaxe completa) resolvidos contra a ficha + TODOS os
 * contratos/parcelas/prazos vinculados — não só o mais recente de cada.
 *
 * Só lista modelos que de fato usam a sintaxe condicional
 * (`modeloUsaLogicaCondicional`, filtrado no servidor por
 * `listarModelosCondicionaisAction`) — modelos puramente literais continuam
 * indo pelo card simples, sem exigir plano Pro.
 */
export function AutomacaoCondicionalCard({
  fichaId,
  modelos,
  temAcesso,
}: {
  fichaId: string;
  modelos: ModeloCondicional[];
  temAcesso: boolean;
}) {
  const [modeloSelecionadoId, setModeloSelecionadoId] = useState(modelos[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();
  const [isPendingDocx, startTransitionDocx] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [avisoDocx, setAvisoDocx] = useState<string | null>(null);
  const [textoGerado, setTextoGerado] = useState<string | null>(null);
  const [variaveisNaoResolvidas, setVariaveisNaoResolvidas] = useState<string[]>([]);
  const [copiado, setCopiado] = useState(false);

  if (!temAcesso) {
    return (
      <Card>
        <div className="mb-1 flex items-center justify-between">
          <CardTitle>Automação de documento com lógica condicional</CardTitle>
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-silver-2">
            Pro
          </span>
        </div>
        <p className="text-sm text-muted">
          Modelos com blocos condicionais (ex: incluir uma cláusula só para determinada área do direito, ou listar
          automaticamente cada parcela em atraso) são um recurso do <span className="font-medium text-ice">Plano Pro</span>.
          Assine em{" "}
          <a href="/app/perfil" className="text-ice underline underline-offset-2">
            Meu perfil
          </a>{" "}
          para liberar.
        </p>
      </Card>
    );
  }

  if (modelos.length === 0) {
    return (
      <Card>
        <div className="mb-1 flex items-center justify-between">
          <CardTitle>Automação de documento com lógica condicional</CardTitle>
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-silver-2">
            Pro
          </span>
        </div>
        <p className="text-sm text-muted">
          Nenhum modelo com lógica condicional cadastrado ainda. Em &quot;Modelos&quot;, use{" "}
          <code className="rounded bg-white/10 px-1 py-0.5 text-xs">{'{{#se area_direito == "Trabalhista"}}...{{/se}}'}</code>{" "}
          ou{" "}
          <code className="rounded bg-white/10 px-1 py-0.5 text-xs">{"{{#cada parcelas}}...{{/cada}}"}</code> para
          criar um.
        </p>
      </Card>
    );
  }

  function gerar() {
    if (!modeloSelecionadoId) {
      setErro("Selecione um modelo para gerar o documento.");
      return;
    }
    setErro(null);
    setCopiado(false);
    startTransition(async () => {
      const resultado = await gerarDocumentoCondicionalAction(fichaId, modeloSelecionadoId);
      if (!resultado.ok) {
        setErro(resultado.error);
        setTextoGerado(null);
        return;
      }
      setTextoGerado(resultado.resultado.textoFinal);
      setVariaveisNaoResolvidas(resultado.resultado.variaveisNaoResolvidas);
    });
  }

  function baixarDocumentoDocx() {
    if (!modeloSelecionadoId) {
      setErro("Selecione um modelo para gerar o documento.");
      return;
    }
    setErro(null);
    setAvisoDocx(null);
    startTransitionDocx(async () => {
      try {
        const resposta = await fetch(
          `/api/fichas/${fichaId}/documento-condicional?modeloId=${modeloSelecionadoId}`,
        );

        if (!resposta.ok) {
          const corpo = (await resposta.json().catch(() => null)) as { error?: string } | null;
          setErro(corpo?.error ?? "Não foi possível gerar o documento. Tente novamente.");
          return;
        }

        const pendentes = (resposta.headers.get("X-Variaveis-Nao-Resolvidas") ?? "")
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean);
        if (pendentes.length > 0) {
          setAvisoDocx(`Documento gerado com lacunas: revise ${pendentes.join(", ")} antes de protocolar.`);
        }

        const disposicao = resposta.headers.get("Content-Disposition") ?? "";
        const nomeArquivo = /filename="([^"]+)"/.exec(disposicao)?.[1] ?? "documento.docx";

        const blob = await resposta.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = nomeArquivo;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      } catch {
        setErro("Falha de rede ao gerar o documento. Tente novamente.");
      }
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

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <CardTitle>Automação de documento com lógica condicional</CardTitle>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-silver-2">
          Pro
        </span>
      </div>

      <p className="mb-4 text-sm text-muted">
        O modelo escolhido tem blocos condicionais ou de repetição — o documento é montado com base na ficha e em
        TODOS os contratos, parcelas e prazos vinculados ao caso (não só o mais recente).
      </p>

      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <Label htmlFor="modelo-condicional">Modelo</Label>
            <Select
              id="modelo-condicional"
              value={modeloSelecionadoId}
              onChange={(e) => setModeloSelecionadoId(e.target.value)}
            >
              {modelos.map((modelo) => (
                <option key={modelo.id} value={modelo.id}>
                  {modelo.nome}
                </option>
              ))}
            </Select>
          </div>
          <Button onClick={baixarDocumentoDocx} disabled={isPendingDocx} size="sm">
            {isPendingDocx ? "Gerando documento…" : "Gerar documento (.docx)"}
          </Button>
          <Button onClick={gerar} disabled={isPending} variant="secondary" size="sm">
            {isPending ? "Gerando…" : "Ver texto antes"}
          </Button>
        </div>

        <FieldError>{erro}</FieldError>

        {avisoDocx && (
          <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-300">
            {avisoDocx}
          </p>
        )}

        {textoGerado && (
          <div className="space-y-3">
            {variaveisNaoResolvidas.length > 0 && (
              <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-300">
                Atenção: não foi possível resolver {variaveisNaoResolvidas.join(", ")} — revise o texto abaixo antes
                de usar.
              </p>
            )}

            <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-navy-2 p-4 text-sm leading-relaxed text-ice-2">
              {textoGerado}
            </pre>

            <Button type="button" variant="secondary" size="sm" onClick={copiar}>
              {copiado ? "Copiado!" : "Copiar texto"}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
