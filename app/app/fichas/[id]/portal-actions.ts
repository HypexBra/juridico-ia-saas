"use server";

import crypto from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { notificarClientePortal } from "@/lib/notificacoes/notificar-cliente";
import type { ClientePortal } from "@/lib/types";

const TTL_CONVITE_DIAS = 7;

const convidarSchema = z.object({
  fichaId: z.string().uuid("Ficha inválida."),
  nome: z.string().trim().min(1, "Informe o nome do cliente."),
  email: z.string().trim().min(1, "Informe o e-mail do cliente.").email("E-mail inválido."),
});

export type ConvidarClienteState = {
  error: string | null;
  /** Caminho relativo (`/portal/ativar?token=...`) — o componente monta a
   * URL absoluta com `window.location.origin` porque não há uma env var de
   * URL pública configurada no projeto para montar isso no servidor. */
  linkConvite: string | null;
};

export async function convidarClientePortalAction(
  _prev: ConvidarClienteState,
  formData: FormData,
): Promise<ConvidarClienteState> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { error: "Sessão expirada. Faça login novamente.", linkConvite: null };

  const parsed = convidarSchema.safeParse({
    fichaId: formData.get("fichaId"),
    nome: formData.get("nome"),
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos.", linkConvite: null };
  }

  const supabase = await createClient();

  const { data: ficha } = await supabase
    .from("fichas_caso")
    .select("id")
    .eq("id", parsed.data.fichaId)
    .maybeSingle();

  if (!ficha) return { error: "Ficha não encontrada.", linkConvite: null };

  const { data: existente } = await supabase
    .from("clientes_portal")
    .select("*")
    .eq("ficha_caso_id", parsed.data.fichaId)
    .maybeSingle<ClientePortal>();

  if (existente?.auth_user_id) {
    return {
      error: "Este cliente já ativou o acesso ao portal — não é possível gerar um novo convite.",
      linkConvite: null,
    };
  }

  const token = crypto.randomBytes(32).toString("hex");
  const conviteExpiraEm = new Date(Date.now() + TTL_CONVITE_DIAS * 24 * 60 * 60 * 1000).toISOString();

  if (existente) {
    const { error } = await supabase
      .from("clientes_portal")
      .update({
        nome: parsed.data.nome,
        email: parsed.data.email,
        token_convite: token,
        convite_expira_em: conviteExpiraEm,
      })
      .eq("id", existente.id);

    if (error) return { error: "Não foi possível gerar o convite. Tente novamente.", linkConvite: null };
  } else {
    const { error } = await supabase.from("clientes_portal").insert({
      escritorio_id: usuario.perfil.escritorio_id,
      ficha_caso_id: parsed.data.fichaId,
      nome: parsed.data.nome,
      email: parsed.data.email,
      token_convite: token,
      convite_expira_em: conviteExpiraEm,
    });

    if (error) return { error: "Não foi possível gerar o convite. Tente novamente.", linkConvite: null };
  }

  revalidatePath(`/app/fichas/${parsed.data.fichaId}`);

  return { error: null, linkConvite: `/portal/ativar?token=${token}` };
}

const notificarSchema = z.object({
  fichaId: z.string().uuid("Ficha inválida."),
  mensagem: z.string().trim().min(1, "Escreva uma mensagem para o cliente.").max(1000, "Mensagem muito longa."),
});

export type NotificarClienteState = {
  error: string | null;
  ok: boolean;
  /** true quando a ficha tem cliente com portal ativo e a notificação foi
   * de fato enviada; false (sem erro) quando ainda não há cliente ativo. */
  notificado: boolean;
};

export async function notificarClienteAction(
  _prev: NotificarClienteState,
  formData: FormData,
): Promise<NotificarClienteState> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { error: "Sessão expirada. Faça login novamente.", ok: false, notificado: false };

  const parsed = notificarSchema.safeParse({
    fichaId: formData.get("fichaId"),
    mensagem: formData.get("mensagem"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos.", ok: false, notificado: false };
  }

  const supabase = await createClient();
  const resultado = await notificarClientePortal(supabase, {
    fichaCasoId: parsed.data.fichaId,
    escritorioId: usuario.perfil.escritorio_id,
    tipo: "mensagem_advogado",
    mensagem: parsed.data.mensagem,
  });

  if (!resultado.ok) return { error: resultado.error, ok: false, notificado: false };

  revalidatePath(`/app/fichas/${parsed.data.fichaId}`);
  return { error: null, ok: true, notificado: resultado.notificado };
}
