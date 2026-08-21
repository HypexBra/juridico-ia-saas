"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getAdminAtual } from "@/lib/admin/auth";
import { registrarLogAdmin } from "@/lib/admin/log";
import { createClient } from "@/lib/supabase/server";

export type AdminActionResultado = { ok: true; mensagem: string } | { ok: false; error: string };

/**
 * Exclusão de conversa pelo admin (seção 8) — mesma precaução da exclusão
 * pelo próprio usuário (app/app/chat/actions.ts): desvincula `fichas_caso`
 * antes de excluir, pra nunca arrastar um caso/contrato real junto.
 */
export async function excluirConversaAdminAction(conversaId: string): Promise<AdminActionResultado> {
  const admin = await getAdminAtual();
  if (!admin) return { ok: false, error: "Não autorizado." };

  const parsed = z.string().uuid().safeParse(conversaId);
  if (!parsed.success) return { ok: false, error: "Conversa inválida." };

  const supabase = await createClient();

  const { error: erroDesvincular } = await supabase.from("fichas_caso").update({ conversa_id: null }).eq("conversa_id", parsed.data);
  if (erroDesvincular) {
    console.error("[admin/conversas] Falha ao desvincular fichas_caso:", erroDesvincular);
    return { ok: false, error: "Não foi possível excluir a conversa (falha ao preservar casos vinculados)." };
  }

  const { error } = await supabase.from("conversas").delete().eq("id", parsed.data);
  if (error) {
    console.error("[admin/conversas] Falha ao excluir conversa:", error);
    return { ok: false, error: "Não foi possível excluir a conversa." };
  }

  await registrarLogAdmin(admin, { acao: "excluir_conversa", alvoTipo: "conversa", alvoId: parsed.data });

  revalidatePath("/admin/conversas");
  return { ok: true, mensagem: "Conversa excluída com sucesso." };
}
