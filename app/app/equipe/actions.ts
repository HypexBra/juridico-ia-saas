"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { obterAppUrl } from "@/lib/app/url";
import type { ConviteEquipe, Perfil, Role } from "@/lib/types";

const convidarSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome da pessoa."),
  email: z.string().trim().min(1, "Informe o e-mail.").email("E-mail inválido."),
  role: z.enum(["admin", "advogado"] as const, { message: "Papel inválido." }),
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
 * Convida um novo membro para o MESMO escritório (migration 0038): cria a
 * conta no Supabase Auth via `admin.inviteUserByEmail` (o próprio Supabase
 * envia o e-mail com o link — mesmo mecanismo já comprovado em produção por
 * `redefinirSenhaUsuarioAction`, sem precisar de provedor de e-mail próprio)
 * e registra o convite pendente. O convidado define senha em
 * `/auth/definir-senha` e, no primeiro login,
 * `lib/onboarding.ts#aceitarConviteEquipeSePendente` cria o perfil dele
 * DIRETO neste escritório — nunca cria um escritório novo.
 *
 * Ordem deliberada: chama o Auth ANTES de gravar o convite. Se o e-mail já
 * tiver conta (`inviteUserByEmail` falha com "already registered"), nada é
 * persistido — evita convite órfão sem conta correspondente.
 */
export async function convidarAction(
  _prev: ConvidarState,
  formData: FormData,
): Promise<ConvidarState> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { error: "Sessão expirada. Faça login novamente.", sucesso: null };
  if (usuario.perfil.role !== "owner" && usuario.perfil.role !== "admin") {
    return { error: "Só o titular ou administrador(a) do escritório pode convidar membros.", sucesso: null };
  }

  const parsed = convidarSchema.safeParse({
    nome: formData.get("nome"),
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos.", sucesso: null };
  }
  const { nome, email, role } = parsed.data;

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch (erro) {
    console.error("[app/equipe] createAdminClient indisponível para convite:", erro);
    return { error: "SUPABASE_SERVICE_ROLE_KEY não configurada — convite por e-mail indisponível.", sucesso: null };
  }

  const { error: erroConvite } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${obterAppUrl()}/auth/callback?next=/auth/definir-senha`,
  });
  if (erroConvite) {
    const jaExiste = /already registered|already exists|already been registered/i.test(erroConvite.message);
    console.error("[app/equipe] Falha ao enviar convite por e-mail:", erroConvite);
    return {
      error: jaExiste
        ? `Já existe uma conta com o e-mail ${email}. Peça para essa pessoa contatar o suporte se ela deveria estar em outro escritório.`
        : "Não foi possível enviar o convite. Tente novamente.",
      sucesso: null,
    };
  }

  const supabase = await createClient();
  const { error: erroInsert } = await supabase.from("convites_equipe").insert({
    escritorio_id: usuario.perfil.escritorio_id,
    email,
    nome,
    role,
    criado_por: usuario.perfil.id,
  });
  if (erroInsert) {
    // A conta no Auth já foi criada e o e-mail de convite já foi enviado —
    // não há como desfazer isso de forma limpa (o Supabase não oferece
    // "cancelar convite enviado"), então o registro em `convites_equipe`
    // ficando faltando só significa que o aceite no primeiro login vai falhar
    // (nenhum convite pendente pra casar) — logado para diagnóstico manual.
    console.error("[app/equipe] Convite enviado mas falha ao registrar em convites_equipe:", erroInsert, { email });
    return {
      error: "O e-mail de convite foi enviado, mas houve um erro ao registrá-lo. Contate o suporte.",
      sucesso: null,
    };
  }

  revalidatePath("/app/equipe");
  return { error: null, sucesso: `Convite enviado para ${email}.` };
}

export type ConvitesPendentesResultado = { ok: true; convites: ConviteEquipe[] } | { ok: false; error: string };

/** Lista os convites pendentes do PRÓPRIO escritório (RLS `convites_equipe_gestor` já restringe). */
export async function listarConvitesPendentesAction(): Promise<ConvitesPendentesResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("convites_equipe")
    .select("*")
    .eq("status", "pendente")
    .order("criado_em", { ascending: false })
    .returns<ConviteEquipe[]>();

  if (error) {
    console.error("[app/equipe] Falha ao listar convites pendentes:", error);
    return { ok: false, error: "Não foi possível carregar os convites pendentes." };
  }
  return { ok: true, convites: data ?? [] };
}

/** Cancela um convite pendente do PRÓPRIO escritório (owner/admin). */
export async function cancelarConviteAction(conviteId: string): Promise<EquipeActionResultado> {
  const parsedId = uuidSchema.safeParse(conviteId);
  if (!parsedId.success) return { ok: false, error: "Convite inválido." };

  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };
  if (usuario.perfil.role !== "owner" && usuario.perfil.role !== "admin") {
    return { ok: false, error: "Só o titular ou administrador(a) do escritório pode cancelar convites." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("convites_equipe")
    .update({ status: "cancelado" })
    .eq("id", parsedId.data)
    .eq("status", "pendente");

  if (error) {
    console.error("[app/equipe] Falha ao cancelar convite:", error);
    return { ok: false, error: "Não foi possível cancelar o convite." };
  }

  revalidatePath("/app/equipe");
  return { ok: true, mensagem: "Convite cancelado." };
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
