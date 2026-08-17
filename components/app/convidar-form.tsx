"use client";

import { useActionState } from "react";
import { convidarAction, type ConvidarState } from "@/app/app/equipe/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

const INITIAL_STATE: ConvidarState = { error: null, sucesso: null };

export function ConvidarForm() {
  const [state, formAction, isPending] = useActionState(convidarAction, INITIAL_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Label htmlFor="email">E-mail para convidar</Label>
        <Input id="email" name="email" type="email" placeholder="colega@escritorio.com.br" required />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Enviando…" : "Convidar"}
      </Button>
      {state.error && <p className="text-xs text-red-400 sm:ml-3">{state.error}</p>}
      {state.sucesso && <p className="text-xs text-muted sm:ml-3">{state.sucesso}</p>}
    </form>
  );
}
