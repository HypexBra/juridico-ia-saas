"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { buscarConfiguracoesPlataforma } from "@/lib/admin/configuracoes";

const loginSchema = z.object({
  email: z.string().trim().min(1, "Informe o e-mail.").email("E-mail inválido."),
  senha: z.string().min(1, "Informe a senha."),
});

export type LoginState = {
  error: string | null;
};

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    senha: formData.get("senha"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.senha,
  });

  if (error) {
    if (error.message.toLowerCase().includes("invalid login credentials")) {
      return { error: "E-mail ou senha incorretos." };
    }
    if (error.message.toLowerCase().includes("email not confirmed")) {
      return { error: "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada." };
    }
    return { error: "Não foi possível entrar. Tente novamente em instantes." };
  }

  const { modoManutencao } = await buscarConfiguracoesPlataforma();
  if (modoManutencao) {
    const { data: userData } = await supabase.auth.getUser();
    const { data: admin } = userData.user
      ? await supabase.from("plataforma_admins").select("id").eq("auth_user_id", userData.user.id).eq("ativo", true).maybeSingle()
      : { data: null };

    if (!admin) {
      await supabase.auth.signOut();
      return { error: "O sistema está em manutenção no momento. Tente novamente em instantes." };
    }
  }

  redirect("/app/dashboard");
}
