"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { NovoContratoHonorarioForm } from "@/components/app/novo-contrato-honorario-form";

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
  const router = useRouter();

  function fechar() {
    setAberto(false);
  }

  if (fichas.length === 0) {
    return (
      <p className="text-sm text-muted">
        Cadastre uma ficha de caso antes de criar um contrato de honorário.
      </p>
    );
  }

  if (!aberto) {
    return <Button onClick={() => setAberto(true)}>+ Novo contrato</Button>;
  }

  return (
    <Dialog
      aberto={aberto}
      onFechar={fechar}
      titulo="Novo contrato de honorário"
      mostrarBotaoFechar
      overlayClassName="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/40 p-4"
      painelClassName="my-8 w-full max-w-2xl rounded-xl border border-ink/10 bg-navy-2 p-6 shadow-2xl shadow-ink/10"
    >
      <NovoContratoHonorarioForm
        fichas={fichas}
        perfis={perfis}
        onSucesso={() => {
          fechar();
          router.refresh();
        }}
      />
    </Dialog>
  );
}
