"use client";

import { useActionState, useEffect, useRef } from "react";
import { criarPrazoAction, type CriarPrazoState } from "@/app/app/prazos/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, FieldError } from "@/components/ui/input";

const INITIAL_STATE: CriarPrazoState = { error: null };

export function NovoPrazoForm() {
  const [state, formAction, isPending] = useActionState(criarPrazoAction, INITIAL_STATE);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!isPending && !state.error) {
      formRef.current?.reset();
    }
  }, [isPending, state.error]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <div>
          <Label htmlFor="titulo">Título</Label>
          <Input id="titulo" name="titulo" required placeholder="Ex: Contestação — Processo 0001234-56" />
        </div>
        <div>
          <Label htmlFor="dataPrazo">Data do prazo</Label>
          <Input id="dataPrazo" name="dataPrazo" type="date" required />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="processo">Processo (opcional)</Label>
          <Input id="processo" name="processo" placeholder="0001234-56.2026.8.26.0100" />
        </div>
        <div>
          <Label htmlFor="clienteNome">Cliente (opcional)</Label>
          <Input id="clienteNome" name="clienteNome" placeholder="Nome do cliente" />
        </div>
      </div>

      <div>
        <Label htmlFor="descricao">Descrição (opcional)</Label>
        <Textarea id="descricao" name="descricao" rows={2} placeholder="Detalhes adicionais do prazo" />
      </div>

      <FieldError>{state.error}</FieldError>

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando…" : "Adicionar prazo"}
        </Button>
      </div>
    </form>
  );
}
