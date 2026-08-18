"use client";

import { useActionState } from "react";
import { enviarTriagemAction, type EnviarTriagemState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, FieldError } from "@/components/ui/input";

const INITIAL_STATE: EnviarTriagemState = { ok: false, error: "" };

export function TriagemForm({ slug }: { slug: string }) {
  const acaoComSlug = enviarTriagemAction.bind(null, slug);
  const [state, formAction, isPending] = useActionState(acaoComSlug, INITIAL_STATE);

  if (state.ok) {
    return (
      <div className="space-y-2 text-center">
        <h2 className="font-display text-lg font-semibold text-ice">Recebemos sua mensagem</h2>
        <p className="text-sm text-muted">
          Nossa equipe vai analisar o seu caso e entrar em contato em breve. Obrigado por confiar no nosso trabalho.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="nome">Seu nome</Label>
        <Input id="nome" name="nome" required placeholder="Nome completo" autoComplete="name" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="telefone">Telefone</Label>
          <Input
            id="telefone"
            name="telefone"
            placeholder="(11) 99999-9999"
            autoComplete="tel"
          />
        </div>
        <div>
          <Label htmlFor="email">E-mail (opcional)</Label>
          <Input id="email" name="email" type="email" placeholder="voce@email.com" autoComplete="email" />
        </div>
      </div>

      <div>
        <Label htmlFor="relato">Conte o que aconteceu</Label>
        <Textarea
          id="relato"
          name="relato"
          required
          rows={6}
          minLength={20}
          maxLength={4000}
          placeholder="Descreva a situação com o máximo de detalhes possível: o que aconteceu, quando, e quem está envolvido."
        />
      </div>

      {state.error && <FieldError>{state.error}</FieldError>}

      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending ? "Enviando…" : "Enviar meu caso"}
      </Button>

      <p className="text-center text-xs text-muted">
        Ao enviar, você concorda em ser contatado pelo escritório sobre este caso.
      </p>
    </form>
  );
}
