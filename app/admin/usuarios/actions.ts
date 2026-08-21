"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getAdminAtual } from "@/lib/admin/auth";
import { registrarLogAdmin } from "@/lib/admin/log";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { obterAppUrl } from "@/lib/app/url";
import type { Role } from "@/lib/types";

export type AdminActionResultado = { ok: true; mensagem: string } | { ok: false; error: string };

const uuidSchema = z.string().uuid();

export async function alternarAtivoUsuarioAction(perfilId: string, novoAtivo: boolean): Promise<AdminActionResultado> {
  const admin = await getAdminAtual();
  if (!admin) return { ok: false, error: "Não autorizado." };

  const parsed = uuidSchema.safeParse(perfilId);
  if (!parsed.success) return { ok: false, error: "Usuário inválido." };

  const supabase = await createClient();
  const { error } = await supabase.from("perfis").update({ ativo: novoAtivo }).eq("id", parsed.data);
  if (error) {
    console.error("[admin/usuarios] Falha ao alternar ativo:", error);
    return { ok: false, error: "Não foi possível atualizar o status do usuário." };
  }

  await registrarLogAdmin(admin, {
    acao: novoAtivo ? "ativar_usuario" : "desativar_usuario",
    alvoTipo: "perfil",
    alvoId: parsed.data,
  });

  revalidatePath("/admin/usuarios");
  revalidatePath(`/admin/usuarios/${parsed.data}`);
  return { ok: true, mensagem: novoAtivo ? "Usuário ativado com sucesso." : "Usuário desativado com sucesso." };
}

const ROLES_VALIDOS: Role[] = ["owner", "admin", "advogado"];

export async function alterarRoleUsuarioAction(perfilId: string, novoRole: string): Promise<AdminActionResultado> {
  const admin = await getAdminAtual();
  if (!admin) return { ok: false, error: "Não autorizado." };

  const parsedId = uuidSchema.safeParse(perfilId);
  if (!parsedId.success) return { ok: false, error: "Usuário inválido." };
  if (!ROLES_VALIDOS.includes(novoRole as Role)) return { ok: false, error: "Tipo de usuário inválido." };

  const supabase = await createClient();
  const { error } = await supabase.from("perfis").update({ role: novoRole }).eq("id", parsedId.data);
  if (error) {
    console.error("[admin/usuarios] Falha ao alterar role:", error);
    return { ok: false, error: "Não foi possível alterar o tipo do usuário." };
  }

  await registrarLogAdmin(admin, {
    acao: "alterar_role_usuario",
    alvoTipo: "perfil",
    alvoId: parsedId.data,
    detalhes: { novoRole },
  });

  revalidatePath("/admin/usuarios");
  revalidatePath(`/admin/usuarios/${parsedId.data}`);
  return { ok: true, mensagem: "Tipo de usuário atualizado com sucesso." };
}

/**
 * Exclui a linha de `perfis` (seção 7). A conta de `auth.users` só é
 * removida de verdade quando `SUPABASE_SERVICE_ROLE_KEY` estiver configurada
 * (Admin API) — ver docs/adrs/0003-admin-plataforma.md. Conversas/prazos
 * relacionados são preservados (FKs já usam `on delete set null`), nunca
 * excluídos em cascata — só o vínculo com o autor é perdido.
 */
export async function excluirUsuarioAction(perfilId: string): Promise<AdminActionResultado> {
  const admin = await getAdminAtual();
  if (!admin) return { ok: false, error: "Não autorizado." };

  const parsed = uuidSchema.safeParse(perfilId);
  if (!parsed.success) return { ok: false, error: "Usuário inválido." };

  const supabase = await createClient();
  const { data: perfil } = await supabase.from("perfis").select("auth_user_id").eq("id", parsed.data).maybeSingle<{ auth_user_id: string }>();

  const { error } = await supabase.from("perfis").delete().eq("id", parsed.data);
  if (error) {
    console.error("[admin/usuarios] Falha ao excluir perfil:", error);
    return { ok: false, error: "Não foi possível excluir o usuário." };
  }

  let avisoContaAuth = "";
  if (perfil?.auth_user_id) {
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const adminClient = createAdminClient();
      const { error: erroAuth } = await adminClient.auth.admin.deleteUser(perfil.auth_user_id);
      if (erroAuth) {
        console.error("[admin/usuarios] Falha ao excluir conta de auth:", erroAuth);
        avisoContaAuth = " (conta de login não pôde ser removida — verifique os logs)";
      }
    } catch {
      avisoContaAuth = " (conta de login mantida: SUPABASE_SERVICE_ROLE_KEY não configurada)";
    }
  }

  await registrarLogAdmin(admin, { acao: "excluir_usuario", alvoTipo: "perfil", alvoId: parsed.data });

  revalidatePath("/admin/usuarios");
  return { ok: true, mensagem: `Usuário excluído com sucesso.${avisoContaAuth}` };
}

export async function promoverAdminPlataformaAction(perfilId: string): Promise<AdminActionResultado> {
  const admin = await getAdminAtual();
  if (!admin) return { ok: false, error: "Não autorizado." };

  const parsed = uuidSchema.safeParse(perfilId);
  if (!parsed.success) return { ok: false, error: "Usuário inválido." };

  const { listarUsuariosAdmin } = await import("@/lib/admin/usuarios");
  const alvo = (await listarUsuariosAdmin()).find((u) => u.perfilId === parsed.data);
  if (!alvo) return { ok: false, error: "Usuário não encontrado." };
  if (!alvo.email) {
    return {
      ok: false,
      error: "E-mail deste usuário indisponível (configure SUPABASE_SERVICE_ROLE_KEY para promover a admin).",
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
    console.error("[admin/usuarios] Falha ao promover admin:", error);
    return { ok: false, error: error.code === "23505" ? "Este usuário já é admin da plataforma." : "Não foi possível promover o usuário." };
  }

  await registrarLogAdmin(admin, { acao: "promover_admin_plataforma", alvoTipo: "perfil", alvoId: parsed.data });

  revalidatePath("/admin/usuarios");
  revalidatePath("/admin/administradores");
  return { ok: true, mensagem: "Usuário promovido a administrador da plataforma." };
}

const PLANOS_VALIDOS = ["free", "pro"] as const;

/**
 * Altera `escritorios.plano` (fonte de verdade do gating de feature, ver
 * `lib/planos/gating.ts`) diretamente pelo painel admin — uso operacional
 * (ex: cortesia, correção manual de um webhook Stripe perdido), sem passar
 * pelo Stripe Checkout. Não mexe em `assinaturas` (espelho local da
 * subscription Stripe): este campo é só o override manual que o gating de
 * fato lê.
 */
export async function alterarPlanoEscritorioAction(
  escritorioId: string,
  novoPlano: string,
): Promise<AdminActionResultado> {
  const admin = await getAdminAtual();
  if (!admin) return { ok: false, error: "Não autorizado." };

  const parsedId = uuidSchema.safeParse(escritorioId);
  if (!parsedId.success) return { ok: false, error: "Escritório inválido." };
  if (!PLANOS_VALIDOS.includes(novoPlano as (typeof PLANOS_VALIDOS)[number])) {
    return { ok: false, error: "Plano inválido." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("escritorios").update({ plano: novoPlano }).eq("id", parsedId.data);
  if (error) {
    console.error("[admin/usuarios] Falha ao alterar plano do escritório:", error);
    return { ok: false, error: "Não foi possível alterar o plano do escritório." };
  }

  await registrarLogAdmin(admin, {
    acao: "alterar_plano_escritorio",
    alvoTipo: "escritorio",
    alvoId: parsedId.data,
    detalhes: { novoPlano },
  });

  revalidatePath("/admin/usuarios");
  revalidatePath(`/admin/usuarios/${escritorioId}`);
  return { ok: true, mensagem: `Plano do escritório alterado para ${novoPlano === "pro" ? "Pro" : "Free"}.` };
}

/**
 * Dispara o e-mail padrão de redefinição de senha do Supabase Auth para o
 * usuário (`auth.resetPasswordForEmail`) — NUNCA define uma senha nova
 * diretamente aqui: uma senha temporária definida pelo admin teria que
 * transitar por este código/log/tela até chegar ao usuário, e é exatamente
 * esse trânsito que se quer evitar. O próprio Supabase Auth envia o e-mail
 * com o link (nenhum token passa pelo nosso servidor além do necessário
 * para localizar o e-mail do usuário).
 */
export async function redefinirSenhaUsuarioAction(perfilId: string): Promise<AdminActionResultado> {
  const admin = await getAdminAtual();
  if (!admin) return { ok: false, error: "Não autorizado." };

  const parsed = uuidSchema.safeParse(perfilId);
  if (!parsed.success) return { ok: false, error: "Usuário inválido." };

  const { listarUsuariosAdmin } = await import("@/lib/admin/usuarios");
  const alvo = (await listarUsuariosAdmin()).find((u) => u.perfilId === parsed.data);
  if (!alvo) return { ok: false, error: "Usuário não encontrado." };
  if (!alvo.email) {
    return {
      ok: false,
      error: "E-mail deste usuário indisponível (configure SUPABASE_SERVICE_ROLE_KEY para redefinir a senha).",
    };
  }

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch (erro) {
    console.error("[admin/usuarios] createAdminClient indisponível:", erro);
    return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY não configurada." };
  }

  const { error } = await adminClient.auth.resetPasswordForEmail(alvo.email, {
    redirectTo: `${obterAppUrl()}/auth/callback?next=/auth/definir-senha`,
  });
  if (error) {
    console.error("[admin/usuarios] Falha ao enviar e-mail de redefinição de senha:", error);
    return { ok: false, error: "Não foi possível enviar o e-mail de redefinição de senha." };
  }

  await registrarLogAdmin(admin, {
    acao: "redefinir_senha_usuario",
    alvoTipo: "perfil",
    alvoId: parsed.data,
    detalhes: { email: alvo.email },
  });

  return { ok: true, mensagem: `E-mail de redefinição de senha enviado para ${alvo.email}.` };
}
