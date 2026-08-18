import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { ClientePortal } from "@/lib/types";

export type ClientePortalAtual = {
  userId: string;
  email: string | null;
  clientePortal: ClientePortal;
};

/**
 * Resolve o cliente do portal autenticado — espelha `getUsuarioAtual` (para
 * advogados), mas resolvendo `clientes_portal` em vez de `perfis`.
 *
 * Contexto de autenticação totalmente separado: um advogado autenticado não
 * tem linha em `clientes_portal` (retorna `null` aqui) e um cliente do
 * portal não tem linha em `perfis` (retorna `null` em `getUsuarioAtual`) —
 * cada área só reconhece o tipo de usuário certo.
 *
 * Se o cliente confirmou a conta agora mas ainda não foi vinculado (caso o
 * projeto Supabase exija confirmação de e-mail: o `signUp` guarda o token
 * de convite em `user_metadata.portal_token_convite` porque não havia
 * sessão ativa para rodar a RPC de vínculo na hora), completa o vínculo
 * aqui chamando `ativar_convite_cliente_portal` — mesmo padrão de
 * onboarding adiado usado por `getUsuarioAtual`/`criarEscritorioEPerfil`.
 *
 * Retorna `null` se não há sessão, ou se há sessão mas não há convite
 * (pendente ou já processado) para vincular.
 */
export const getClientePortalAtual = cache(async (): Promise<ClientePortalAtual | null> => {
  const supabase = await createClient();

  const userIdDoHeader = (await headers()).get("x-user-id");

  let user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | null =
    userIdDoHeader ? { id: userIdDoHeader } : null;

  if (!user) {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  }

  if (!user) return null;

  const primeiraTentativa = await supabase
    .from("clientes_portal")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle<ClientePortal>();

  if (primeiraTentativa.error) throw primeiraTentativa.error;

  let clientePortal = primeiraTentativa.data;

  if (!clientePortal) {
    if (!user.user_metadata) {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return null;
      user = data.user;
    }

    const tokenConvite = user.user_metadata?.portal_token_convite as string | undefined;
    if (!tokenConvite) return null;

    const { error: erroVinculo } = await supabase.rpc("ativar_convite_cliente_portal", {
      p_token: tokenConvite,
    });
    if (erroVinculo) return null;

    const segundaTentativa = await supabase
      .from("clientes_portal")
      .select("*")
      .eq("auth_user_id", user.id)
      .maybeSingle<ClientePortal>();

    if (segundaTentativa.error || !segundaTentativa.data) return null;
    clientePortal = segundaTentativa.data;
  }

  let email = user.email ?? null;
  if (!email) {
    const { data } = await supabase.auth.getUser();
    email = data.user?.email ?? null;
  }

  return {
    userId: user.id,
    email,
    clientePortal,
  };
});
