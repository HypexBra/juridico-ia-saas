"use server";

import { revalidatePath } from "next/cache";
import { getAdminAtual } from "@/lib/admin/auth";
import { registrarLogAdmin } from "@/lib/admin/log";
import { createClient } from "@/lib/supabase/server";

export type AdminActionResultado = { ok: true; mensagem: string } | { ok: false; error: string };

export async function atualizarConfiguracaoAction(
  campo: "modo_manutencao" | "novos_cadastros_habilitados",
  valor: boolean,
): Promise<AdminActionResultado> {
  const admin = await getAdminAtual();
  if (!admin) return { ok: false, error: "Não autorizado." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("configuracoes_plataforma")
    .update({ [campo]: valor, atualizado_por: admin.admin.id, atualizado_em: new Date().toISOString() })
    .eq("id", true);

  if (error) {
    console.error("[admin/configuracoes] Falha ao atualizar:", error);
    return { ok: false, error: "Não foi possível salvar a configuração." };
  }

  await registrarLogAdmin(admin, { acao: "atualizar_configuracao_plataforma", alvoTipo: "configuracao", alvoId: campo, detalhes: { valor } });

  revalidatePath("/admin/configuracoes");
  return { ok: true, mensagem: "Configuração atualizada." };
}
