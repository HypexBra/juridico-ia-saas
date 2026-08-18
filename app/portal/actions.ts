"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getClientePortalAtual } from "@/lib/app/current-client-portal";

export async function portalLogoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/portal/login");
}

export type MarcarNotificacaoResultado = { ok: true } | { ok: false; error: string };

/**
 * Único "write" permitido na área do cliente: marcar a PRÓPRIA notificação
 * como lida. Nunca edita dados do caso (ficha/prazo) — RLS
 * (`notificacoes_cliente_self_update`, migration 0003) também restringe a
 * atualização à própria linha, mas o filtro por `cliente_portal_id` aqui
 * evita depender só da RLS para essa garantia.
 */
export async function marcarNotificacaoLidaAction(notificacaoId: string): Promise<MarcarNotificacaoResultado> {
  const clientePortalAtual = await getClientePortalAtual();
  if (!clientePortalAtual) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notificacoes_cliente")
    .update({ lida: true })
    .eq("id", notificacaoId)
    .eq("cliente_portal_id", clientePortalAtual.clientePortal.id);

  if (error) return { ok: false, error: "Não foi possível marcar como lida. Tente novamente." };

  revalidatePath("/portal");
  return { ok: true };
}

export async function marcarTodasNotificacoesLidasAction(): Promise<MarcarNotificacaoResultado> {
  const clientePortalAtual = await getClientePortalAtual();
  if (!clientePortalAtual) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notificacoes_cliente")
    .update({ lida: true })
    .eq("cliente_portal_id", clientePortalAtual.clientePortal.id)
    .eq("lida", false);

  if (error) return { ok: false, error: "Não foi possível marcar as notificações como lidas." };

  revalidatePath("/portal");
  return { ok: true };
}
