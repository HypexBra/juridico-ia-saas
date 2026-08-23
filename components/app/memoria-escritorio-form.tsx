"use client";

import { useActionState } from "react";
import { salvarMemoriaEscritorioAction, type MemoriaEscritorioState } from "@/app/app/perfil/actions";
import { Button } from "@/components/ui/button";
import { FieldError, Label, Select, Textarea } from "@/components/ui/input";
import { TOM_LABELS, type MemoriaEscritorio } from "@/lib/ia/contexto-escritorio";

const INITIAL_STATE: MemoriaEscritorioState = { error: null, sucesso: null };

const MAX_DIRETRIZES_CHARS = 4000;
const MAX_CLAUSULAS_CHARS = 6000;

export function MemoriaEscritorioForm({ memoria }: { memoria: MemoriaEscritorio }) {
  const [state, formAction, isPending] = useActionState(salvarMemoriaEscritorioAction, INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="tom-memoria">Tom de escrita preferido</Label>
        <Select id="tom-memoria" name="tom" defaultValue={memoria.tomEscrita}>
          {Object.entries(TOM_LABELS).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="diretrizes-memoria">Diretrizes de redação</Label>
        <Textarea
          id="diretrizes-memoria"
          name="diretrizes"
          rows={5}
          maxLength={MAX_DIRETRIZES_CHARS}
          defaultValue={memoria.diretrizes}
          placeholder="Ex.: citar sempre a base legal de cada pedido; nunca usar superlativos; preferir parágrafos curtos…"
        />
        <p className="mt-1 text-[11px] text-muted">
          Até {MAX_DIRETRIZES_CHARS.toLocaleString("pt-BR")} caracteres.
        </p>
      </div>

      <div>
        <Label htmlFor="clausulas-memoria">Cláusulas padrão</Label>
        <Textarea
          id="clausulas-memoria"
          name="clausulas"
          rows={5}
          maxLength={MAX_CLAUSULAS_CHARS}
          defaultValue={memoria.clausulasPadrao}
          placeholder="Ex.: cláusula de confidencialidade, foro de eleição, multa por atraso…"
        />
        <p className="mt-1 text-[11px] text-muted">
          Até {MAX_CLAUSULAS_CHARS.toLocaleString("pt-BR")} caracteres.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando…" : "Salvar"}
        </Button>
        <FieldError>{state.error}</FieldError>
        {state.sucesso && <p className="text-xs text-muted">{state.sucesso}</p>}
      </div>
    </form>
  );
}
