import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificarClientePortalInput = {
  /** Ficha de caso cujo(s) cliente(s) do portal devem ser notificados. */
  fichaCasoId: string;
  escritorioId: string;
  /** Categoria livre — usada só para exibição/filtro futuro no portal. */
  tipo: string;
  mensagem: string;
};

export type NotificarClientePortalResultado =
  | { ok: true; notificado: boolean }
  | { ok: false; error: string };

/**
 * Insere uma notificação em `notificacoes_cliente` para o(s) cliente(s) do
 * portal vinculados à ficha informada.
 *
 * Ponto de extensão isolado (fora de `app/app/prazos/actions.ts`) para
 * qualquer fluxo de aplicação que precise avisar o cliente sobre uma
 * mudança no caso — hoje usado pela ação "Enviar atualização ao cliente" da
 * tela de detalhe da ficha. A notificação de prazo criado/atualizado em si
 * já roda via trigger de banco (`trg_notificar_cliente_portal_prazo`,
 * migration 0006) para cobrir qualquer caminho de escrita em `prazos`, sem
 * depender deste helper ser chamado.
 *
 * Só notifica clientes que já ATIVARAM o portal (`auth_user_id` presente);
 * convite ainda pendente não tem sessão para "ler" a notificação.
 * `notificado: false` (não é erro) quando a ficha não tem cliente ativo no
 * portal — o chamador não precisa tratar isso como falha do fluxo principal.
 */
export async function notificarClientePortal(
  supabase: SupabaseClient,
  input: NotificarClientePortalInput,
): Promise<NotificarClientePortalResultado> {
  const mensagem = input.mensagem.trim();
  if (!mensagem) {
    return { ok: false, error: "A mensagem da notificação não pode ser vazia." };
  }

  const { data: clientesPortal, error: erroBusca } = await supabase
    .from("clientes_portal")
    .select("id")
    .eq("ficha_caso_id", input.fichaCasoId)
    .not("auth_user_id", "is", null);

  if (erroBusca) {
    return { ok: false, error: "Não foi possível localizar o cliente do portal desta ficha." };
  }

  if (!clientesPortal || clientesPortal.length === 0) {
    return { ok: true, notificado: false };
  }

  const agora = new Date().toISOString();
  const { error: erroInsert } = await supabase.from("notificacoes_cliente").insert(
    clientesPortal.map((cliente) => ({
      escritorio_id: input.escritorioId,
      cliente_portal_id: cliente.id as string,
      ficha_caso_id: input.fichaCasoId,
      tipo: input.tipo,
      mensagem,
      enviada_em: agora,
    })),
  );

  if (erroInsert) {
    return { ok: false, error: "Não foi possível enviar a notificação ao cliente." };
  }

  return { ok: true, notificado: true };
}
