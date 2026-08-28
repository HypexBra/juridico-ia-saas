"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { obterAppUrl } from "@/lib/app/url";
import { verificarRateLimit } from "@/lib/rate-limit";

const recuperarSchema = z.object({
  email: z.string().trim().min(1, "Informe o e-mail.").email("E-mail inválido."),
});

export type RecuperarSenhaState = {
  enviado: boolean;
  error: string | null;
};

const MAX_TENTATIVAS = 5;
const JANELA_MS = 10 * 60 * 1000; // 10 minutos

async function resolverIpOrigem(): Promise<string> {
  const listaHeaders = await headers();
  const encaminhadoPor = listaHeaders.get("x-forwarded-for");
  if (encaminhadoPor) return encaminhadoPor.split(",")[0]?.trim() ?? "desconhecido";
  return listaHeaders.get("x-real-ip") ?? "desconhecido";
}

export async function recuperarSenhaPortalAction(
  _prev: RecuperarSenhaState,
  formData: FormData,
): Promise<RecuperarSenhaState> {
  const parsed = recuperarSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { enviado: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const ip = await resolverIpOrigem();
  const permitido = await verificarRateLimit(`recuperar-senha-portal:${ip}`, {
    maxTentativas: MAX_TENTATIVAS,
    janelaMs: JANELA_MS,
  });
  if (!permitido) {
    return { enviado: false, error: "Muitas tentativas em pouco tempo. Aguarde alguns minutos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    // Cliente do portal também cai em /auth/definir-senha (mesmo form,
    // ambos os fluxos só chamam updateUser na sessão já trocada) — depois
    // de definir a senha, o próprio destino padrão (/app/dashboard) não se
    // aplica a um cliente, mas o form já força ida ao dashboard; como o
    // cliente do portal não tem perfil de escritório, o middleware o
    // redireciona de volta ao /portal na tentativa seguinte de acesso.
    redirectTo: `${obterAppUrl()}/auth/callback?next=/auth/definir-senha`,
  });

  if (error) {
    console.error("[portal/recuperar] Falha ao disparar e-mail de redefinição:", error);
  }

  return { enviado: true, error: null };
}
