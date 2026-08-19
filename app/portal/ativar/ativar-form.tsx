"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ativarContaPortalAction, type AtivarContaState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

const INITIAL_STATE: AtivarContaState = {
  error: null,
  precisaConfirmarEmail: false,
  emailJaExiste: false,
};

export function AtivarForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(ativarContaPortalAction, INITIAL_STATE);

  if (state.precisaConfirmarEmail) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-sm text-ice-2">
          Quase lá! Enviamos um e-mail de confirmação. Depois de confirmar, volte e entre pelo portal.
        </p>
        <Link href="/portal/login" className="inline-block text-sm font-medium text-silver hover:text-silver-2">
          Ir para o login
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="token" value={token} />

      <div>
        <Label htmlFor="senha">Crie uma senha</Label>
        <Input
          id="senha"
          name="senha"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          required
          minLength={8}
        />
      </div>

      <div>
        <Label htmlFor="confirmarSenha">Confirme a senha</Label>
        <Input
          id="confirmarSenha"
          name="confirmarSenha"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          required
          minLength={8}
        />
      </div>

      {state.error && (
        <div>
          <p role="alert" className="rounded-lg border border-red-500/30 bg-red-950/30 px-3.5 py-2.5 text-sm text-red-300">
            {state.error}
          </p>
          {state.emailJaExiste && (
            <Link
              href={`/portal/login?token=${encodeURIComponent(token)}`}
              className="mt-2 inline-block text-sm font-medium text-silver hover:text-silver-2"
            >
              Entrar com minha conta existente
            </Link>
          )}
        </div>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending ? "Criando acesso…" : "Ativar meu acesso"}
      </Button>
    </form>
  );
}
