"use client";

import { useActionState } from "react";
import { convidarAction, type ConvidarState } from "@/app/app/equipe/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

const INITIAL_STATE: ConvidarState = { error: null, sucesso: null };

export function ConvidarForm() {
  const [state, formAction, isPending] = useActionState(convidarAction, INITIAL_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
      <div className="flex-1 min-w-[160px]">
        <Label htmlFor="nome">Nome</Label>
        <Input id="nome" name="nome" type="text" placeholder="Nome completo" required />
      </div>
      <div className="flex-1 min-w-[200px]">
        <Label htmlFor="email">E-mail para convidar</Label>
        <Input id="email" name="email" type="email" placeholder="colega@escritorio.com.br" required />
      </div>
      <div className="min-w-[160px]">
        <Label htmlFor="role">Papel</Label>
        <select
          id="role"
          name="role"
          defaultValue="advogado"
          className="h-10 w-full rounded-lg border border-white/10 bg-navy-3 px-3 text-sm text-ice"
        >
          <option value="advogado">Advogado(a)</option>
          <option value="admin">Administrador(a)</option>
        </select>
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Enviando…" : "Convidar"}
      </Button>
      {state.error && <p className="w-full text-xs text-red-400">{state.error}</p>}
      {state.sucesso && <p className="w-full text-xs text-muted">{state.sucesso}</p>}
    </form>
  );
}
