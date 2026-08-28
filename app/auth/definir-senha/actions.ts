"use server";

import { getUsuarioAtual } from "@/lib/app/current-user";
import { getClientePortalAtual } from "@/lib/app/current-client-portal";

/**
 * Resolve pra onde mandar o usuário depois de definir a senha nesta página
 * compartilhada por dois fluxos (convite/redefinição de advogado E de
 * cliente do portal, ver comentário de `DefinirSenhaForm`): a sessão já
 * existe neste ponto (trocada via /auth/callback), então basta checar em
 * qual das duas tabelas a linha vive.
 */
export async function resolverDestinoPosSenhaAction(): Promise<string> {
  const usuario = await getUsuarioAtual();
  if (usuario) return "/app/dashboard";

  const clientePortal = await getClientePortalAtual();
  if (clientePortal) return "/portal";

  // Nenhum dos dois: sessão órfã (não deveria acontecer no fluxo normal) —
  // login genérico é o destino mais seguro.
  return "/login";
}
