"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().trim().min(1, "Informe o e-mail.").email("E-mail inválido."),
  senha: z.string().min(1, "Informe a senha."),
  // Presente quando o cliente veio de um segundo convite (`/portal/ativar`)
  // enquanto já tinha conta de um caso anterior — ver `ativar/actions.ts`.
  tokenConvitePendente: z.string().trim().optional(),
});

export type PortalLoginState = { error: string | null };

export async function portalLoginAction(
  _prev: PortalLoginState,
  formData: FormData,
): Promise<PortalLoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    senha: formData.get("senha"),
    tokenConvitePendente: formData.get("tokenConvitePendente") || undefined,
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

  // Cliente com mais de um caso no escritório: o segundo (ou terceiro...)
  // convite não pôde ser vinculado no signUp porque já existia conta com
  // este e-mail — vincula agora, com a sessão que acabou de abrir.
  if (parsed.data.tokenConvitePendente) {
    await supabase.rpc("ativar_convite_cliente_portal", { p_token: parsed.data.tokenConvitePendente });
  }

  redirect("/portal");
}
