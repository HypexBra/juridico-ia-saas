"use client";

import { useActionState } from "react";
import Link from "next/link";
import { recuperarSenhaAction, type RecuperarSenhaState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

const INITIAL_STATE: RecuperarSenhaState = { enviado: false, error: null };

export function RecuperarSenhaForm() {
  const [state, formAction, isPending] = useActionState(recuperarSenhaAction, INITIAL_STATE);

  if (state.enviado) {
    return (
      <div className="space-y-5">
        <p className="rounded-lg border border-ink/10 bg-paper-2 px-3.5 py-3 text-sm text-ink-2">
          Se houver uma conta com este e-mail, enviamos um link para redefinir a senha. Confira sua
          caixa de entrada (e o spam).
        </p>
        <Link
          href="/login"
          className="block text-center text-sm font-medium text-silver underline underline-offset-2 hover:text-silver-2"
        >
          Voltar para o login
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="voce@escritorio.com.br"
          required
        />
      </div>

      {state.error && (
        <p role="alert" className="rounded-lg border border-red-700/20 bg-red-700/10 px-3.5 py-2.5 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending ? "Enviando…" : "Enviar link de redefinição"}
      </Button>

      <p className="text-center text-sm text-muted">
        <Link href="/login" className="font-medium text-silver underline underline-offset-2 hover:text-silver-2">
          Voltar para o login
        </Link>
      </p>
    </form>
  );
}
