"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label, Input, Textarea, FieldError } from "@/components/ui/input";
import {
  analisarColadoAction,
  analisarTeseCadastradaAction,
  analisarUploadAction,
  listarTesesParaAdvogadoContraAction,
  type TeseParaSelecaoAdvogadoContra,
} from "@/app/app/advogado-contra/actions";

const ACCEPT_TESE =
  ".pdf,.docx,.jpg,.jpeg,.png,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp";

type ModoEntrada = "colado" | "upload" | "tese_cadastrada";

const STATUS_TESE_LABEL: Record<TeseParaSelecaoAdvogadoContra["status"], string> = {
  em_avaliacao: "Em avaliação",
  adotada: "Adotada",
  descartada: "Descartada",
};

/**
 * Formulário do Advogado do Contra (`/app/advogado-contra/novo`, ADR 0013):
 * espelha `AuditorForm` (Fase 4), com um 3º modo NOVO — "tese cadastrada",
 * que dispensa texto/arquivo e só pede a seleção de uma tese já registrada
 * em `teses_caso` (Fase 1). Quando aberto com `?fichaId=` (atalho de
 * `/app/fichas/[id]`), o seletor de teses já vem pré-filtrado para as teses
 * daquela ficha e o modo "tese cadastrada" é selecionado por padrão (é o
 * caminho mais provável de quem chega pelo atalho da ficha).
 */
export function AdvogadoContraForm({ fichaCasoId }: { fichaCasoId?: string | null }) {
  const [modo, setModo] = useState<ModoEntrada>(fichaCasoId ? "tese_cadastrada" : "colado");
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [teseSelecionadaId, setTeseSelecionadaId] = useState("");
  const [teses, setTeses] = useState<TeseParaSelecaoAdvogadoContra[] | null>(null);
  const [erroTeses, setErroTeses] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [, startCarregamentoTeses] = useTransition();

  useEffect(() => {
    startCarregamentoTeses(async () => {
      const resultado = await listarTesesParaAdvogadoContraAction(fichaCasoId ?? null);
      if (!resultado.ok) {
        setErroTeses(resultado.error);
        return;
      }
      setTeses(resultado.teses);
      if (resultado.teses.length > 0 && resultado.teses[0]) {
        setTeseSelecionadaId(resultado.teses[0].id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fichaCasoId]);

  function enviar(formData: FormData) {
    setErro(null);
    if (fichaCasoId) formData.set("fichaCasoId", fichaCasoId);

    startTransition(async () => {
      if (modo === "tese_cadastrada") {
        if (!teseSelecionadaId) {
          setErro("Selecione uma tese cadastrada.");
          return;
        }
        const resultado = await analisarTeseCadastradaAction(teseSelecionadaId);
        if (!resultado.ok) setErro(resultado.error);
        return;
      }

      const resultado =
        modo === "colado" ? await analisarColadoAction(formData) : await analisarUploadAction(formData);
      if (!resultado.ok) setErro(resultado.error);
    });
  }

  return (
    <div className="space-y-4">
      {fichaCasoId && (
        <p className="text-xs text-muted">Esta análise será vinculada à ficha de caso de origem.</p>
      )}

      <div className="inline-flex flex-wrap rounded-lg border border-white/10 bg-navy-2 p-1" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={modo === "colado"}
          onClick={() => setModo("colado")}
          disabled={isPending}
          className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
            modo === "colado" ? "bg-silver/15 text-silver-2" : "text-muted hover:text-ice"
          }`}
        >
          Colar texto
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={modo === "upload"}
          onClick={() => setModo("upload")}
          disabled={isPending}
          className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
            modo === "upload" ? "bg-silver/15 text-silver-2" : "text-muted hover:text-ice"
          }`}
        >
          Enviar arquivo
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={modo === "tese_cadastrada"}
          onClick={() => setModo("tese_cadastrada")}
          disabled={isPending}
          className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
            modo === "tese_cadastrada" ? "bg-silver/15 text-silver-2" : "text-muted hover:text-ice"
          }`}
        >
          Tese cadastrada
        </button>
      </div>

      <form action={enviar} className="space-y-4">
        {modo !== "tese_cadastrada" && (
          <div>
            <Label htmlFor="advogado-contra-titulo">Título/identificação (opcional)</Label>
            <Input
              id="advogado-contra-titulo"
              name="titulo"
              placeholder="Ex: Tese de prescrição — Processo 0001234-56.2026"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              disabled={isPending}
            />
          </div>
        )}

        {modo === "colado" && (
          <div>
            <Label htmlFor="advogado-contra-texto">Texto da tese ou peça</Label>
            <Textarea
              id="advogado-contra-texto"
              name="texto"
              rows={14}
              placeholder="Cole aqui a tese, o argumento ou o trecho da peça que você quer testar contra…"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              disabled={isPending}
            />
          </div>
        )}

        {modo === "upload" && (
          <div>
            <Label htmlFor="advogado-contra-arquivo">Tese ou peça (PDF, DOCX ou imagem — até 15MB)</Label>
            <input
              id="advogado-contra-arquivo"
              name="arquivo"
              type="file"
              accept={ACCEPT_TESE}
              required
              disabled={isPending}
              className="block w-full text-sm text-ice file:mr-3 file:rounded-lg file:border-0 file:bg-navy-3 file:px-3 file:py-2 file:text-sm file:text-ice hover:file:bg-navy-3/70"
            />
          </div>
        )}

        {modo === "tese_cadastrada" && (
          <div>
            <Label htmlFor="advogado-contra-tese">Tese cadastrada no caso</Label>
            {erroTeses ? (
              <p className="text-sm text-red-400">{erroTeses}</p>
            ) : teses === null ? (
              <p className="text-sm text-muted">Carregando teses…</p>
            ) : teses.length === 0 ? (
              <p className="text-sm text-muted">
                Nenhuma tese cadastrada ainda. Cadastre uma tese na aba &quot;Teses&quot; de uma ficha de caso antes
                de usar este modo.
              </p>
            ) : (
              <select
                id="advogado-contra-tese"
                value={teseSelecionadaId}
                onChange={(e) => setTeseSelecionadaId(e.target.value)}
                disabled={isPending}
                className="block w-full rounded-lg border border-white/10 bg-navy-3 px-3 py-2 text-sm text-ice focus:border-silver focus:outline-none"
              >
                {teses.map((tese) => (
                  <option key={tese.id} value={tese.id}>
                    {tese.tese.slice(0, 80)}
                    {tese.tese.length > 80 ? "…" : ""} · {STATUS_TESE_LABEL[tese.status]}
                    {tese.nomeCliente ? ` · ${tese.nomeCliente}` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <Button
          type="submit"
          disabled={
            isPending ||
            (modo === "colado" && !texto.trim()) ||
            (modo === "tese_cadastrada" && (!teses || teses.length === 0 || !teseSelecionadaId))
          }
          size="sm"
        >
          {isPending ? "Analisando…" : "Analisar como advogado do contra"}
        </Button>

        <FieldError>{erro}</FieldError>

        {isPending && (
          <p className="text-xs text-muted">
            A análise pode levar até 2 minutos — não saia desta página. Você será redirecionado para o resultado
            assim que terminar.
          </p>
        )}
      </form>
    </div>
  );
}
