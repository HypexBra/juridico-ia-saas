"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getClientePortalAtual } from "@/lib/app/current-client-portal";
import { escritorioTemAcesso } from "@/lib/planos/gating";
import { enviarMensagemPortalSchema } from "@/lib/mensagens-portal/mensagens";
import type { MensagemPortalCliente } from "@/lib/types";

export type EnviarMensagemClienteResultado =
  | { ok: true; mensagem: MensagemPortalCliente }
  | { ok: false; error: string };

/**
 * Envia mensagem do CLIENTE para o escritório (chat da feature Pro
 * "portal_cliente_rico"). `fichaId` é conferido contra a própria ficha do
 * cliente logado antes de inserir — mesmo que a RLS (migration 0019) já
 * derive `ficha_caso_id`/`escritorio_id` de `clientes_portal` no `WITH
 * CHECK`, essa checagem aqui garante que o erro retornado ao usuário é uma
 * mensagem clara em vez de um erro genérico de RLS.
 */
export async function enviarMensagemClienteAction(
  fichaId: string,
  conteudo: string,
): Promise<EnviarMensagemClienteResultado> {
  const clientePortalAtual = await getClientePortalAtual();
  if (!clientePortalAtual) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const { clientePortal } = clientePortalAtual;
  if (clientePortal.ficha_caso_id !== fichaId) {
    return { ok: false, error: "Ficha inválida para este cliente." };
  }

  const temAcesso = await escritorioTemAcesso(clientePortal.escritorio_id, "portal_cliente_rico");
  if (!temAcesso) return { ok: false, error: "O chat com o escritório não está disponível no momento." };

  const parsed = enviarMensagemPortalSchema.safeParse({ fichaId, conteudo });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mensagens_portal_cliente")
    .insert({
      escritorio_id: clientePortal.escritorio_id,
      ficha_caso_id: parsed.data.fichaId,
      cliente_portal_id: clientePortal.id,
      remetente: "cliente",
      conteudo: parsed.data.conteudo,
    })
    .select("*")
    .single<MensagemPortalCliente>();

  if (error || !data) return { ok: false, error: "Não foi possível enviar a mensagem. Tente novamente." };

  revalidatePath("/portal");
  return { ok: true, mensagem: data };
}
