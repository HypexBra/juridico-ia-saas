"use server";

import { z } from "zod";
import { getUsuarioAtual } from "@/lib/app/current-user";

const convidarSchema = z.object({
  email: z.string().trim().min(1, "Informe o e-mail.").email("E-mail inválido."),
});

export type ConvidarState = { error: string | null; sucesso: string | null };

/**
 * Convite por e-mail ainda não está implementado (requer configuração de um
 * provedor de e-mail transacional). Por ora, apenas valida o e-mail e informa
 * ao usuário que a funcionalidade está a caminho — nenhum e-mail é enviado.
 */
export async function convidarAction(
  _prev: ConvidarState,
  formData: FormData,
): Promise<ConvidarState> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { error: "Sessão expirada. Faça login novamente.", sucesso: null };

  const parsed = convidarSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "E-mail inválido.", sucesso: null };
  }

  return {
    error: null,
    sucesso: `O envio de convites por e-mail ainda está em breve. Por enquanto, peça para ${parsed.data.email} se cadastrar diretamente e depois ajuste o papel dele(a) na equipe.`,
  };
}
