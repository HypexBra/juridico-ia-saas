"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

const SELETOR_FOCAVEL =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

const OVERLAY_PADRAO = "fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4";
const PAINEL_PADRAO =
  "w-full max-w-lg rounded-xl border border-white/10 bg-navy-2 p-6 shadow-2xl";

type DialogProps = {
  aberto: boolean;
  onFechar: () => void;
  titulo: ReactNode;
  children: ReactNode;
  /** Classes completas do backdrop (substitui o padrão); use para variações como `overflow-y-auto`. */
  overlayClassName?: string;
  /** Classes completas do painel (substitui o padrão); use para variações de largura/altura máxima. */
  painelClassName?: string;
  /** Exibe um botão "✕" ao lado do título em vez de só o `<h2>` (padrão do contrato de honorário). */
  mostrarBotaoFechar?: boolean;
};

/**
 * Modal compartilhado (foco + Escape + portal) usado por `NovaFichaDialog`,
 * `NovoContratoHonorarioDialog` e `NovoModeloDialog` — antes cada um
 * duplicava essa mecânica de forma quase idêntica.
 *
 * Renderiza via `createPortal` direto em `document.body`: o ancestral
 * `overflow-x-hidden` de `components/app/app-shell.tsx` (necessário para
 * conter a landing/dashboard) clipava/desalinhava esses modais `fixed
 * inset-0` quando renderizados dentro da árvore normal do dashboard — o
 * portal escapa desse ancestral sem precisar mexer no layout do shell.
 */
export function Dialog({
  aberto,
  onFechar,
  titulo,
  children,
  overlayClassName,
  painelClassName,
  mostrarBotaoFechar = false,
}: DialogProps) {
  const tituloId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const elementoAnteriorRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!aberto) return;

    elementoAnteriorRef.current = document.activeElement as HTMLElement | null;
    const primeiroFocavel = dialogRef.current?.querySelector<HTMLElement>(SELETOR_FOCAVEL);
    primeiroFocavel?.focus();

    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        evento.preventDefault();
        onFechar();
      }
    }

    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      elementoAnteriorRef.current?.focus();
    };
  }, [aberto, onFechar]);

  if (!aberto) return null;

  return createPortal(
    <div className={overlayClassName ?? OVERLAY_PADRAO}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className={painelClassName ?? PAINEL_PADRAO}
      >
        {mostrarBotaoFechar ? (
          <div className="mb-4 flex items-center justify-between">
            <h2 id={tituloId} className="font-display text-lg font-semibold text-ice">
              {titulo}
            </h2>
            <button
              type="button"
              onClick={onFechar}
              aria-label="Fechar"
              className="cursor-pointer rounded-md px-2 py-1 text-muted transition-colors hover:bg-white/5 hover:text-ice"
            >
              ✕
            </button>
          </div>
        ) : (
          <h2 id={tituloId} className="mb-4 font-display text-lg font-semibold text-ice">
            {titulo}
          </h2>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
