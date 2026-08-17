"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ModeloForm } from "./modelo-form";
import { criarModeloAction } from "@/app/app/modelos/actions";

const SELETOR_FOCAVEL =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function NovoModeloDialog() {
  const [aberto, setAberto] = useState(false);
  const tituloId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const elementoAnteriorRef = useRef<HTMLElement | null>(null);

  function abrir() {
    elementoAnteriorRef.current = document.activeElement as HTMLElement | null;
    setAberto(true);
  }

  function fechar() {
    setAberto(false);
    elementoAnteriorRef.current?.focus();
  }

  useEffect(() => {
    if (!aberto) return;

    const primeiroFocavel = dialogRef.current?.querySelector<HTMLElement>(SELETOR_FOCAVEL);
    primeiroFocavel?.focus();

    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        evento.preventDefault();
        fechar();
      }
    }

    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberto]);

  if (!aberto) {
    return <Button onClick={abrir}>+ Novo modelo</Button>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-white/10 bg-navy-2 p-6 shadow-2xl"
      >
        <h2 id={tituloId} className="mb-4 font-display text-lg font-semibold text-ice">
          Novo modelo de peça
        </h2>
        <ModeloForm action={criarModeloAction} onCancelar={fechar} />
      </div>
    </div>
  );
}
