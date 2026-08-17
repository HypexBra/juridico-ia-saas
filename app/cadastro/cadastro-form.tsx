"use client";

import { useActionState } from "react";
import Link from "next/link";
import { cadastroAction, type CadastroState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

const INITIAL_STATE: CadastroState = { error: null, precisaConfirmarEmail: false };

export function CadastroForm() {
  const [state, formAction, isPending] = useActionState(cadastroAction, INITIAL_STATE);

  if (state.precisaConfirmarEmail) {
    return (
      <div className="rounded-lg border border-green/30 bg-green/10 px-4 py-4 text-sm text-ice">
        <p className="font-medium text-green">Quase lá! Confirme seu e-mail.</p>
        <p className="mt-1 text-muted">
          Enviamos um link de confirmação para o e-mail informado. Depois de confirmar, faça{" "}
          <Link href="/login" className="font-medium text-gold hover:text-gold-2">
            login
          </Link>{" "}
          para começar a usar o Jurídico IA.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <Label htmlFor="nomeUsuario">Seu nome completo</Label>
        <Input id="nomeUsuario" name="nomeUsuario" type="text" autoComplete="name" placeholder="Maria Silva" required />
      </div>

      <div>
        <Label htmlFor="nomeEscritorio">Nome do escritório</Label>
        <Input
          id="nomeEscritorio"
          name="nomeEscritorio"
          type="text"
          placeholder="Silva & Associados Advocacia"
          required
        />
      </div>

      <div>
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="voce@escritorio.com.br" required />
      </div>

      <div>
        <Label htmlFor="senha">Senha</Label>
        <Input
          id="senha"
          name="senha"
          type="password"
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          minLength={8}
          required
        />
      </div>

      {state.error && (
        <p role="alert" className="rounded-lg border border-red-500/30 bg-red-950/30 px-3.5 py-2.5 text-sm text-red-300">
          {state.error}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending ? "Criando conta…" : "Criar conta grátis"}
      </Button>

      <p className="text-center text-sm text-muted">
        Já tem conta?{" "}
        <Link href="/login" className="font-medium text-gold hover:text-gold-2">
          Entrar
        </Link>
      </p>
    </form>
  );
}
