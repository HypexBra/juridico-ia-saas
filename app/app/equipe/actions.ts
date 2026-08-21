"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import type { Perfil, Role } from "@/lib/types";

const convidarSchema = z.object({
  email: z.string().trim().min(1, "Informe o e-mail.").email("E-mail inválido."),
});

export type ConvidarState = { error: string | null; sucesso: string | null };

export type EquipeActionResultado = { ok: true; mensagem: string } | { ok: false; error: string };

const uuidSchema = z.string().uuid();
const ROLES_VALIDOS: Role[] = ["owner", "admin", "advogado"];

/**
 * Guard comum das ações de gestão de equipe (seção "admin do escritório"):
 * só owner/admin do PRÓPRIO escritório podem mudar role/status de colegas,
 * nunca de si mesmo (evita autopromoção/autolockout) e nunca de alguém de
 * outro escritório — reforçado aqui na aplicação, mas a garantia real contra
 * vazamento cross-tenant é a RLS (`perfis_update_admin`, migration 0001),
 * que já restringe por `escritorio_id = escritorio_atual()`.
 */
async function autorizarGestaoDeEquipe(perfilAlvoId: string) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false as const, error: "Sessão expirada. Faça login novamente." };

  if (usuario.perfil.role !== "owner" && usuario.perfil.role !== "admin") {
    return { ok: false as const, error: "Só o titular ou administrador(a) do escritório pode gerenciar a equipe." };
  }
  if (perfilAlvoId === usuario.perfil.id) {
    return { ok: false as const, error: "Você não pode alterar o próprio papel/status por aqui." };
  }

  const supabase = await createClient();
  const { data: alvo, error } = await supabase
    .from("perfis")
    .select("*")
    .eq("id", perfilAlvoId)
    .maybeSingle<Perfil>();

  if (error || !alvo) return { ok: false as const, error: "Membro não encontrado." };
  if (alvo.escritorio_id !== usuario.perfil.escritorio_id) {
    return { ok: false as const, error: "Membro não encontrado." };
  }
  // Admin (não-owner) não pode alterar o papel/status de um owner — só o
  // próprio owner (ou outro owner) tem essa prerrogativa.
  if (alvo.role === "owner" && usuario.perfil.role !== "owner") {
    return { ok: false as const, error: "Só o titular pode alterar outro titular." };
  }

  return { ok: true as const, supabase, alvo };
}

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
    sucesso: `O envio de convites por e-mail ainda estará disponível em breve. Por enquanto, peça para ${parsed.data.email} se cadastrar diretamente e depois ajuste o papel dele(a) na equipe.`,
  };
}

/**
 * Admin do escritório (owner/admin) muda o papel de um colega DO PRÓPRIO
 * escritório. Isto é o papel escopado por tenant (`perfis.role`) — não tem
 * qualquer relação com `plataforma_admins` (admin cross-tenant do SaaS, só
 * gerenciável em /admin/administradores pela equipe do produto).
 */
export async function alterarRoleMembroAction(perfilId: string, novoRole: string): Promise<EquipeActionResultado> {
  const parsedId = uuidSchema.safeParse(perfilId);
  if (!parsedId.success) return { ok: false, error: "Membro inválido." };
  if (!ROLES_VALIDOS.includes(novoRole as Role)) return { ok: false, error: "Papel inválido." };

  const autorizacao = await autorizarGestaoDeEquipe(parsedId.data);
  if (!autorizacao.ok) return autorizacao;

  const { supabase, alvo } = autorizacao;
  if (alvo.role === novoRole) return { ok: true, mensagem: "Nenhuma alteração necessária." };

  const { error } = await supabase.from("perfis").update({ role: novoRole }).eq("id", parsedId.data);
  if (error) {
    console.error("[app/equipe] Falha ao alterar role de membro:", error);
    return {
      ok: false,
      error: error.message.includes("último administrador titular")
        ? error.message
        : "Não foi possível alterar o papel deste membro.",
    };
  }

  revalidatePath("/app/equipe");
  return { ok: true, mensagem: "Papel atualizado com sucesso." };
}

/**
 * Admin do escritório (owner/admin) ativa/desativa um colega DO PRÓPRIO
 * escritório (RLS `perfis_update_admin` garante o isolamento por tenant).
 */
export async function alternarAtivoMembroAction(perfilId: string, novoAtivo: boolean): Promise<EquipeActionResultado> {
  const parsedId = uuidSchema.safeParse(perfilId);
  if (!parsedId.success) return { ok: false, error: "Membro inválido." };

  const autorizacao = await autorizarGestaoDeEquipe(parsedId.data);
  if (!autorizacao.ok) return autorizacao;

  const { supabase, alvo } = autorizacao;
  if (alvo.ativo === novoAtivo) return { ok: true, mensagem: "Nenhuma alteração necessária." };

  const { error } = await supabase.from("perfis").update({ ativo: novoAtivo }).eq("id", parsedId.data);
  if (error) {
    console.error("[app/equipe] Falha ao alternar ativo de membro:", error);
    return {
      ok: false,
      error: error.message.includes("último administrador titular")
        ? error.message
        : "Não foi possível atualizar o status deste membro.",
    };
  }

  revalidatePath("/app/equipe");
  return { ok: true, mensagem: novoAtivo ? "Membro ativado." : "Membro desativado." };
}
