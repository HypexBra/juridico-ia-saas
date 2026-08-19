"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { criarEscritorioEPerfil } from "@/lib/onboarding";

const cadastroSchema = z.object({
  nomeUsuario: z.string().trim().min(2, "Informe seu nome completo."),
  nomeEscritorio: z.string().trim().min(2, "Informe o nome do escritório."),
  email: z.string().trim().min(1, "Informe o e-mail.").email("E-mail inválido."),
  senha: z.string().min(8, "A senha precisa ter ao menos 8 caracteres."),
});

export type CadastroState = {
  error: string | null;
  precisaConfirmarEmail: boolean;
};

export async function cadastroAction(
  _prev: CadastroState,
  formData: FormData,
): Promise<CadastroState> {
  const parsed = cadastroSchema.safeParse({
    nomeUsuario: formData.get("nomeUsuario"),
    nomeEscritorio: formData.get("nomeEscritorio"),
    email: formData.get("email"),
    senha: formData.get("senha"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
      precisaConfirmarEmail: false,
    };
  }

  const { nomeUsuario, nomeEscritorio, email, senha } = parsed.data;
  const supabase = await createClient();

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password: senha,
    options: {
      // Guardamos no metadata do auth.users para o caso de o projeto Supabase
      // exigir confirmação de e-mail: o onboarding (criação do escritório e
      // do perfil) só pode rodar com sessão ativa, então é concluído no
      // primeiro login pós-confirmação (ver app/app/layout.tsx).
      data: { nome_usuario: nomeUsuario, nome_escritorio: nomeEscritorio },
    },
  });

  if (signUpError) {
    if (signUpError.message.toLowerCase().includes("already registered")) {
      return { error: "Já existe uma conta com este e-mail.", precisaConfirmarEmail: false };
    }
    // Loga a causa real (ex: senha fraca rejeitada pelo provider, rate limit,
    // projeto Supabase mal configurado) — sem isso a mensagem genérica pro
    // usuário não deixa nenhum rastro no server para diagnóstico.
    console.error("[cadastro/cadastroAction] Falha no signUp:", signUpError);
    return { error: "Não foi possível criar a conta. Tente novamente.", precisaConfirmarEmail: false };
  }

  const authUser = signUpData.user;
  if (!authUser) {
    console.error("[cadastro/cadastroAction] signUp sem erro mas sem usuário retornado.", {
      signUpData,
    });
    return { error: "Não foi possível criar a conta. Tente novamente.", precisaConfirmarEmail: false };
  }

  // Se o projeto Supabase exige confirmação de e-mail, ainda não há sessão ativa
  // (signUpData.session é null) e o RLS de INSERT em `escritorios`/`perfis` exige
  // auth.uid() != null, então o onboarding precisa esperar o primeiro login.
  if (!signUpData.session) {
    return { error: null, precisaConfirmarEmail: true };
  }

  try {
    await criarEscritorioEPerfil(supabase, authUser.id, nomeUsuario, nomeEscritorio);
  } catch (erro) {
    console.error("[cadastro/cadastroAction] Falha ao concluir onboarding pós-signUp:", erro, {
      authUserId: authUser.id,
    });
    return {
      error: "Conta criada, mas houve um erro ao configurar o escritório. Contate o suporte.",
      precisaConfirmarEmail: false,
    };
  }

  redirect("/app/dashboard");
}
