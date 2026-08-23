"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ModeloForm } from "./modelo-form";
import { criarModeloAction } from "@/app/app/modelos/actions";

export function NovoModeloDialog() {
  const [aberto, setAberto] = useState(false);

  function fechar() {
    setAberto(false);
  }

  if (!aberto) {
    return <Button onClick={() => setAberto(true)}>+ Novo modelo</Button>;
  }

  return (
    <Dialog
      aberto={aberto}
      onFechar={fechar}
      titulo="Novo modelo de peça"
      painelClassName="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-ink/10 bg-navy-2 p-6 shadow-xl shadow-ink/[0.12]"
    >
      <ModeloForm action={criarModeloAction} onCancelar={fechar} />
    </Dialog>
  );
}
