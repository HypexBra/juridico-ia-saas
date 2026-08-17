"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { NovaFichaForm } from "@/app/app/fichas/nova-ficha-form";

const SELETOR_FOCAVEL =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function NovaFichaDialog() {
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
    return <Button onClick={abrir}>+ Nova ficha</Button>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="w-full max-w-lg rounded-xl border border-white/10 bg-navy-2 p-6 shadow-2xl"
      >
        <h2 id={tituloId} className="mb-4 font-display text-lg font-semibold text-ice">
          Nova ficha de triagem
        </h2>
        <NovaFichaForm onFechar={fechar} />
      </div>
    </div>
  );
}
