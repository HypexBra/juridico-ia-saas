"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { NovaFichaForm } from "@/app/app/fichas/nova-ficha-form";

export function NovaFichaDialog() {
  const [aberto, setAberto] = useState(false);

  function fechar() {
    setAberto(false);
  }

  if (!aberto) {
    return <Button onClick={() => setAberto(true)}>+ Nova ficha</Button>;
  }

  return (
    <Dialog aberto={aberto} onFechar={fechar} titulo="Nova ficha de triagem">
      <NovaFichaForm onFechar={fechar} />
    </Dialog>
  );
}
