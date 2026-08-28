"use client";

import { useActionState } from "react";
import Link from "next/link";
import { portalLoginAction, type PortalLoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

const INITIAL_STATE: PortalLoginState = { error: null };

export function PortalLoginForm({ tokenConvitePendente }: { tokenConvitePendente: string | null }) {
  const [state, formAction, isPending] = useActionState(portalLoginAction, INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-5">
      {tokenConvitePendente && (
        <input type="hidden" name="tokenConvitePendente" value={tokenConvitePendente} />
      )}

      <div>
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="voce@email.com"
          required
        />
      </div>

      <div>
        <Label htmlFor="senha">Senha</Label>
        <Input
          id="senha"
          name="senha"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
        />
        <Link
          href="/portal/recuperar"
          className="mt-1.5 inline-block text-xs font-medium text-silver underline underline-offset-2 hover:text-silver-2"
        >
          Esqueceu a senha?
        </Link>
      </div>

      {state.error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending ? "Entrando…" : "Entrar"}
      </Button>

      <p className="text-center text-xs text-muted">
        Ainda não recebeu o convite? Fale com o escritório responsável pelo seu caso — o acesso ao portal é
        liberado por convite do seu advogado.
      </p>
    </form>
  );
}
