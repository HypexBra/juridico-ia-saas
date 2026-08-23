"use client";

import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import type { CitacaoAnaliseProcesso } from "@/lib/analise-documento/tipos";

export const CERTEZA_TONE: Record<CitacaoAnaliseProcesso["certeza"], "green" | "silver" | "muted"> = {
  confirmado: "green",
  inferido: "silver",
  nao_encontrado: "muted",
};

/**
 * Bloco de um item citável (achado, ponto-chave, cláusula, contra-argumento
 * etc.) — compartilhado entre `documento-resultado.tsx` (Fase 2/Document
 * Intelligence, ADR 0004) e `auditor-resultado.tsx` (Fase 4, ADR 0012), que
 * eram cópia byte-a-byte um do outro (revisão de segurança/QA/techlead).
 * `labelNaoEncontrado` parametriza o único texto que diferia entre os dois
 * ("não encontrado no documento" vs "não encontrado na peça") sem mudar
 * nenhum outro comportamento/visual: um item `certeza: "nao_encontrado"`
 * nunca é apresentado como fato — texto em itálico/cinza — e o trecho de
 * origem (`trechoOriginal`/`pagina`) fica sempre visível junto do item, sem
 * exigir clique extra.
 */
export function ItemCitavel({
  texto,
  citacao,
  extra,
  labelNaoEncontrado,
}: {
  texto: string;
  citacao: CitacaoAnaliseProcesso;
  extra?: ReactNode;
  labelNaoEncontrado: string;
}) {
  const naoEncontrado = citacao.certeza === "nao_encontrado";
  const certezaLabel: Record<CitacaoAnaliseProcesso["certeza"], string> = {
    confirmado: "Confirmado",
    inferido: "Inferido",
    nao_encontrado: labelNaoEncontrado,
  };

  return (
    <li className="rounded-lg border border-ink/10 bg-navy-2 p-3.5">
      <div className="mb-1.5 flex flex-wrap items-start justify-between gap-2">
        <p className={naoEncontrado ? "text-sm italic text-muted" : "text-sm text-ice-2"}>{texto}</p>
        <Badge tone={CERTEZA_TONE[citacao.certeza]}>{certezaLabel[citacao.certeza]}</Badge>
      </div>
      {extra}
      {/* Citação em bloco estilo nota de rodapé de livro: filete de acento à
          esquerda + fundo papel (tema claro) no lugar do separador escuro. */}
      {citacao.trechoOriginal && (
        <p className="mt-2 border-l-2 border-accent bg-paper-2 py-1.5 pl-3 pr-2 text-xs text-muted">
          <span className="font-medium text-silver-2">Trecho de origem</span>
          {citacao.pagina !== null ? ` (pág. ${citacao.pagina})` : ""}: &ldquo;{citacao.trechoOriginal}&rdquo;
        </p>
      )}
    </li>
  );
}

/**
 * Accordion simples de seção com contador — compartilhado entre
 * `documento-resultado.tsx` e `auditor-resultado.tsx` (mesma extração de
 * `ItemCitavel` acima).
 */
export function SecaoAccordion({
  titulo,
  contador,
  children,
}: {
  titulo: string;
  contador: number;
  children: ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="rounded-lg border border-ink/10">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-medium text-ice">
          {titulo} <span className="ml-1 text-xs text-muted">({contador})</span>
        </span>
        <span className="text-xs text-muted">{aberto ? "Recolher" : "Expandir"}</span>
      </button>
      {aberto && <div className="border-t border-ink/10 p-4">{children}</div>}
    </div>
  );
}
