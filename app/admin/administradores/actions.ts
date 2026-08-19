"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getAdminAtual } from "@/lib/admin/auth";
import { registrarLogAdmin } from "@/lib/admin/log";
import { createClient } from "@/lib/supabase/server";
import { listarUsuariosAdmin } from "@/lib/admin/usuarios";

export type AdminActionResultado = { ok: true; mensagem: string } | { ok: false; error: string };

/**
 * Adiciona um admin da plataforma a partir do e-mail de um usuário que já
 * existe em algum escritório (busca em `perfis`/auth via
 * `listarUsuariosAdmin`, mesma fonte usada pela promoção em
 * /admin/usuarios). Um operador sem nenhum perfil de escritório precisa ser
 * cadastrado pelo bootstrap SQL — ver docs/adrs/0003-admin-plataforma.md.
 */
export async function adicionarAdminPorEmailAction(
  _prev: AdminActionResultado | null,
  formData: FormData,
): Promise<AdminActionResultado> {
  const admin = await getAdminAtual();
  if (!admin) return { ok: false, error: "Não autorizado." };

  const parsed = z.string().trim().email("E-mail inválido.").safeParse(formData.get("email"));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "E-mail inválido." };

  const usuarios = await listarUsuariosAdmin();
  const alvo = usuarios.find((u) => u.email?.toLowerCase() === parsed.data.toLowerCase());
  if (!alvo) {
    return {
      ok: false,
      error:
        "Nenhum usuário com esse e-mail encontrado (ou SUPABASE_SERVICE_ROLE_KEY não configurada, sem a qual e-mails não são resolvidos). Para adicionar um operador sem conta de escritório, use o bootstrap SQL documentado no ADR 0003.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("plataforma_admins").insert({
    auth_user_id: alvo.authUserId,
    nome: alvo.nome,
    email: alvo.email,
    criado_por: admin.admin.id,
  });
  if (error) {
    console.error("[admin/administradores] Falha ao adicionar admin:", error);
    return { ok: false, error: error.code === "23505" ? "Este usuário já é admin da plataforma." : "Não foi possível adicionar o administrador." };
  }

  await registrarLogAdmin(admin, { acao: "adicionar_admin_plataforma", alvoTipo: "auth_user", alvoId: alvo.authUserId, detalhes: { email: alvo.email } });

  revalidatePath("/admin/administradores");
  return { ok: true, mensagem: `${alvo.nome} adicionado(a) como administrador(a) da plataforma.` };
}

export async function alternarAtivoAdminAction(adminId: string, novoAtivo: boolean): Promise<AdminActionResultado> {
  const admin = await getAdminAtual();
  if (!admin) return { ok: false, error: "Não autorizado." };

  const parsed = z.string().uuid().safeParse(adminId);
  if (!parsed.success) return { ok: false, error: "Administrador inválido." };

  const supabase = await createClient();
  const { error } = await supabase.from("plataforma_admins").update({ ativo: novoAtivo, atualizado_em: new Date().toISOString() }).eq("id", parsed.data);
  if (error) {
    // A trigger `impedir_remocao_ultimo_admin` (migration 0014) barra desativar o último admin ativo.
    return { ok: false, error: error.message.includes("último administrador") ? error.message : "Não foi possível atualizar o administrador." };
  }

  await registrarLogAdmin(admin, { acao: novoAtivo ? "ativar_admin_plataforma" : "desativar_admin_plataforma", alvoTipo: "plataforma_admin", alvoId: parsed.data });

  revalidatePath("/admin/administradores");
  return { ok: true, mensagem: novoAtivo ? "Administrador ativado." : "Administrador desativado." };
}

export async function removerAdminAction(adminId: string): Promise<AdminActionResultado> {
  const admin = await getAdminAtual();
  if (!admin) return { ok: false, error: "Não autorizado." };

  const parsed = z.string().uuid().safeParse(adminId);
  if (!parsed.success) return { ok: false, error: "Administrador inválido." };

  const supabase = await createClient();
  const { error } = await supabase.from("plataforma_admins").delete().eq("id", parsed.data);
  if (error) {
    return { ok: false, error: error.message.includes("último administrador") ? error.message : "Não foi possível remover o administrador." };
  }

  await registrarLogAdmin(admin, { acao: "remover_admin_plataforma", alvoTipo: "plataforma_admin", alvoId: parsed.data });

  revalidatePath("/admin/administradores");
  return { ok: true, mensagem: "Administrador removido." };
}
