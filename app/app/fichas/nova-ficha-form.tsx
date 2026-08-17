"use client";

import { useActionState, useState } from "react";
import { criarFichaAction, type CriarFichaState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea, FieldError } from "@/components/ui/input";
import { AREAS_DIREITO } from "@/lib/types";

const INITIAL_STATE: CriarFichaState = { error: null };

export function NovaFichaForm({ onFechar }: { onFechar: () => void }) {
  const [state, formAction, isPending] = useActionState(criarFichaAction, INITIAL_STATE);
  const [urgencia, setUrgencia] = useState<"baixa" | "normal" | "alta">("normal");

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="nomeCliente">Nome do cliente</Label>
          <Input id="nomeCliente" name="nomeCliente" required placeholder="Nome completo" />
        </div>
        <div>
          <Label htmlFor="telefone">Telefone</Label>
          <Input id="telefone" name="telefone" placeholder="(11) 99999-9999" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="areaDireito">Área do direito</Label>
          <Select id="areaDireito" name="areaDireito" defaultValue="">
            <option value="" disabled>
              Selecione
            </option>
            {AREAS_DIREITO.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="urgencia">Urgência</Label>
          <Select
            id="urgencia"
            name="urgencia"
            value={urgencia}
            onChange={(e) => setUrgencia(e.target.value as typeof urgencia)}
          >
            <option value="baixa">Baixa</option>
            <option value="normal">Normal</option>
            <option value="alta">Alta</option>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="resumoFatos">Resumo dos fatos</Label>
        <Textarea
          id="resumoFatos"
          name="resumoFatos"
          required
          rows={5}
          placeholder="Descreva o que aconteceu, datas importantes e quem está envolvido."
        />
      </div>

      <FieldError>{state.error}</FieldError>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onFechar} disabled={isPending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando…" : "Salvar ficha"}
        </Button>
      </div>
    </form>
  );
}
