"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea, FieldError } from "@/components/ui/input";
import { AREAS_DIREITO } from "@/lib/types";
import type { Modelo } from "@/lib/types";
import type { ModeloFormState } from "@/app/app/modelos/actions";

const INITIAL_STATE: ModeloFormState = { error: null };

type Action = (prev: ModeloFormState, formData: FormData) => Promise<ModeloFormState>;

export function ModeloForm({
  modelo,
  action,
  onCancelar,
  textoBotao = "Salvar modelo",
}: {
  modelo?: Modelo;
  action: Action;
  onCancelar?: () => void;
  textoBotao?: string;
}) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="nome">Nome do modelo</Label>
          <Input id="nome" name="nome" required defaultValue={modelo?.nome} placeholder="Ex: Petição inicial — Cobrança" />
        </div>
        <div>
          <Label htmlFor="tipo">Tipo de peça</Label>
          <Input id="tipo" name="tipo" defaultValue={modelo?.tipo ?? ""} placeholder="Ex: Petição inicial" />
        </div>
      </div>

      <div>
        <Label htmlFor="area">Área do direito</Label>
        <Select id="area" name="area" defaultValue={modelo?.area ?? ""}>
          <option value="">Não especificada</option>
          {AREAS_DIREITO.map((area) => (
            <option key={area} value={area}>
              {area}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="descricao">Descrição (opcional)</Label>
        <Input id="descricao" name="descricao" defaultValue={modelo?.descricao ?? ""} placeholder="Quando usar este modelo" />
      </div>

      <div>
        <Label htmlFor="conteudo">Conteúdo do modelo</Label>
        <Textarea
          id="conteudo"
          name="conteudo"
          required
          rows={14}
          defaultValue={modelo?.conteudo}
          className="font-mono text-xs"
          placeholder="Cole ou escreva o texto padrão da peça. Use marcadores como [NOME_CLIENTE] para os campos variáveis."
        />
      </div>

      <FieldError>{state.error}</FieldError>

      <div className="flex justify-end gap-3">
        {onCancelar && (
          <Button type="button" variant="secondary" onClick={onCancelar} disabled={isPending}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando…" : textoBotao}
        </Button>
      </div>
    </form>
  );
}
