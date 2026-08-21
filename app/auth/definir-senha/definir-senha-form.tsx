"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

/**
 * Formulário de "definir senha" — usado tanto por convite de equipe
 * (`/app/app/equipe/actions.ts#convidarAction`) quanto por redefinição de
 * senha (`/app/admin/usuarios/actions.ts#redefinirSenhaUsuarioAction`). Os
 * dois fluxos chegam aqui já com sessão ativa (o link do e-mail passa por
 * `/auth/callback`, que troca o `code` por sessão antes de redirecionar
 * pra cá) — este form só chama `updateUser({ password })` na sessão
 * corrente, nunca lida com token/código diretamente.
 */
export function DefinirSenhaForm() {
  const router = useRouter();
  const supabase = createClient();
  const [temSessao, setTemSessao] = useState<boolean | null>(null);
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setTemSessao(Boolean(data.session)));
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (senha.length < 8) {
      setErro("A senha precisa ter ao menos 8 caracteres.");
      return;
    }
    if (senha !== confirmacao) {
      setErro("As senhas não coincidem.");
      return;
    }

    setEnviando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setEnviando(false);

    if (error) {
      setErro("Não foi possível definir a senha. Tente novamente.");
      return;
    }

    router.push("/app/dashboard");
    router.refresh();
  }

  if (temSessao === false) {
    return (
      <p role="alert" className="rounded-lg border border-red-500/30 bg-red-950/30 px-3.5 py-2.5 text-sm text-red-300">
        Este link expirou ou já foi usado. Peça um novo convite/redefinição de senha.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <Label htmlFor="senha">Nova senha</Label>
        <Input
          id="senha"
          name="senha"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          disabled={temSessao === null}
          required
        />
      </div>

      <div>
        <Label htmlFor="confirmacao">Confirme a nova senha</Label>
        <Input
          id="confirmacao"
          name="confirmacao"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
          disabled={temSessao === null}
          required
        />
      </div>

      {erro && (
        <p role="alert" className="rounded-lg border border-red-500/30 bg-red-950/30 px-3.5 py-2.5 text-sm text-red-300">
          {erro}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={enviando || temSessao !== true}>
        {enviando ? "Salvando…" : "Definir senha e entrar"}
      </Button>
    </form>
  );
}
