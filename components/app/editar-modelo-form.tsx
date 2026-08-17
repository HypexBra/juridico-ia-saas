"use client";

import { ModeloForm } from "./modelo-form";
import { atualizarModeloAction } from "@/app/app/modelos/actions";
import type { Modelo } from "@/lib/types";

export function EditarModeloForm({ modelo }: { modelo: Modelo }) {
  const action = atualizarModeloAction.bind(null, modelo.id);
  return <ModeloForm modelo={modelo} action={action} textoBotao="Salvar alterações" />;
}
