"use server";

import { revalidatePath } from "next/cache";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { planoTemAcesso } from "@/lib/planos/gating";
import { notificarClientePortal } from "@/lib/notificacoes/notificar-cliente";
import { enviarMensagemPortalSchema } from "@/lib/mensagens-portal/mensagens";
import type { MensagemPortalCliente } from "@/lib/types";

export type EnviarMensagemEscritorioResultado =
  | { ok: true; mensagem: MensagemPortalCliente }
  | { ok: false; error: string };

/**
 * Envia mensagem do ESCRITÓRIO para o cliente do portal. Além de gravar em
 * `mensagens_portal_cliente`, dispara uma entrada em `notificacoes_cliente`
 * (mecanismo já existente, lido pelo `NotificacoesPanel` do portal) para
 * que o cliente veja o sininho de notificação mesmo com a tela do chat
 * fechada — o Realtime em `mensagens_portal_cliente` só atualiza quem já
 * está com a conversa aberta.
 */
export async function enviarMensagemEscritorioAction(
  fichaId: string,
  clientePortalId: string,
  conteudo: string,
): Promise<EnviarMensagemEscritorioResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  if (!planoTemAcesso(usuario.perfil.escritorio, "portal_cliente_rico")) {
    return { ok: false, error: "Chat com o cliente disponível apenas no plano Pro." };
  }

  const parsed = enviarMensagemPortalSchema.safeParse({ fichaId, conteudo });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();

  const { data: clientePortal } = await supabase
    .from("clientes_portal")
    .select("id, ficha_caso_id")
    .eq("id", clientePortalId)
    .eq("ficha_caso_id", parsed.data.fichaId)
    .maybeSingle();

  if (!clientePortal) return { ok: false, error: "Cliente do portal não encontrado para esta ficha." };

  const { data, error } = await supabase
    .from("mensagens_portal_cliente")
    .insert({
      escritorio_id: usuario.perfil.escritorio_id,
      ficha_caso_id: parsed.data.fichaId,
      cliente_portal_id: clientePortalId,
      remetente: "escritorio",
      conteudo: parsed.data.conteudo,
    })
    .select("*")
    .single<MensagemPortalCliente>();

  if (error || !data) return { ok: false, error: "Não foi possível enviar a mensagem. Tente novamente." };

  // "Fire and forget" de propósito: uma falha ao notificar não deve
  // reverter/bloquear o envio da mensagem em si, que já foi persistida com
  // sucesso — o cliente ainda vê a mensagem ao abrir o chat mesmo sem o
  // sininho de notificação.
  await notificarClientePortal(supabase, {
    fichaCasoId: parsed.data.fichaId,
    escritorioId: usuario.perfil.escritorio_id,
    tipo: "mensagem_chat_portal",
    mensagem: `Nova mensagem do escritório: "${parsed.data.conteudo.slice(0, 120)}"`,
  });

  revalidatePath(`/app/fichas/${parsed.data.fichaId}`);
  return { ok: true, mensagem: data };
}
