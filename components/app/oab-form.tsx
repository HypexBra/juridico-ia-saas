"use client";

import { useActionState } from "react";
import { atualizarOabAction, type AtualizarOabState } from "@/app/app/perfil/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

const INITIAL_STATE: AtualizarOabState = { error: null, sucesso: null };

export function OabForm({ oabAtual }: { oabAtual: string | null }) {
  const [state, formAction, isPending] = useActionState(atualizarOabAction, INITIAL_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Label htmlFor="oab">Número da OAB</Label>
        <Input id="oab" name="oab" defaultValue={oabAtual ?? ""} placeholder="123456/SP" maxLength={20} />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Salvando…" : "Salvar"}
      </Button>
      {state.error && <p className="text-xs text-red-400 sm:ml-3">{state.error}</p>}
      {state.sucesso && <p className="text-xs text-muted sm:ml-3">{state.sucesso}</p>}
    </form>
  );
}
