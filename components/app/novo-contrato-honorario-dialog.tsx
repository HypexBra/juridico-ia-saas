"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { NovoContratoHonorarioForm } from "@/components/app/novo-contrato-honorario-form";

const SELETOR_FOCAVEL =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

type FichaOpcao = { id: string; nome_cliente: string | null };
type PerfilOpcao = { id: string; nome: string };

export function NovoContratoHonorarioDialog({
  fichas,
  perfis,
}: {
  fichas: FichaOpcao[];
  perfis: PerfilOpcao[];
}) {
  const [aberto, setAberto] = useState(false);
  const tituloId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const elementoAnteriorRef = useRef<HTMLElement | null>(null);
  const router = useRouter();

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

  if (fichas.length === 0) {
    return (
      <p className="text-sm text-muted">
        Cadastre uma ficha de caso antes de criar um contrato de honorário.
      </p>
    );
  }

  if (!aberto) {
    return <Button onClick={abrir}>+ Novo contrato</Button>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="my-8 w-full max-w-2xl rounded-xl border border-white/10 bg-navy-2 p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id={tituloId} className="font-display text-lg font-semibold text-ice">
            Novo contrato de honorário
          </h2>
          <button
            type="button"
            onClick={fechar}
            aria-label="Fechar"
            className="cursor-pointer rounded-md px-2 py-1 text-muted transition-colors hover:bg-white/5 hover:text-ice"
          >
            ✕
          </button>
        </div>
        <NovoContratoHonorarioForm
          fichas={fichas}
          perfis={perfis}
          onSucesso={() => {
            fechar();
            router.refresh();
          }}
        />
      </div>
    </div>
  );
}
