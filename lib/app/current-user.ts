import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { criarEscritorioEPerfil } from "@/lib/onboarding";
import type { Escritorio, Perfil } from "@/lib/types";

export type PerfilAtual = Perfil & { escritorio: Escritorio };

export type UsuarioAtual = {
  userId: string;
  email: string | null;
  perfil: PerfilAtual;
};

/**
 * Resolve o usuário autenticado + perfil (com escritório) atual.
 *
 * Se o usuário acabou de confirmar o e-mail e ainda não tem perfil (o
 * onboarding não pôde rodar no cadastro porque não havia sessão ativa),
 * completa o onboarding aqui usando o metadata salvo no signUp.
 *
 * Retorna `null` se não há sessão, ou se há sessão mas não foi possível
 * resolver/criar um perfil (ex: metadata de onboarding ausente).
 *
 * Cacheado por request (React `cache`): layout, page e actions de uma mesma
 * navegação chamam essa função várias vezes, mas só o primeiro chamador de
 * cada requisição paga o custo de rede (auth + query no Supabase).
 */
export const getUsuarioAtual = cache(async (): Promise<UsuarioAtual | null> => {
  const supabase = await createClient();

  // O middleware já validou a sessão e expôs o id via header — evita repetir
  // aqui o round-trip de rede que `auth.getUser()` faz para o Supabase Auth.
  const userIdDoHeader = (await headers()).get("x-user-id");

  let user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | null =
    userIdDoHeader ? { id: userIdDoHeader } : null;

  if (!user) {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  }

  if (!user) return null;

  const primeiraTentativa = await supabase
    .from("perfis")
    .select("*, escritorio:escritorios(*)")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (primeiraTentativa.error) {
    console.error("[current-user/getUsuarioAtual] Falha ao buscar perfil:", primeiraTentativa.error, {
      userId: user.id,
    });
    throw primeiraTentativa.error;
  }

  let perfilComEscritorio = primeiraTentativa.data;

  if (!perfilComEscritorio) {
    // Onboarding recém-confirmado: precisa do metadata completo do auth.users,
    // que o header rápido não carrega — aqui sim vale o round-trip.
    if (!user.user_metadata) {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return null;
      user = data.user;
    }

    const nomeUsuario = user.user_metadata?.nome_usuario as string | undefined;
    const nomeEscritorio = user.user_metadata?.nome_escritorio as string | undefined;
    if (!nomeUsuario || !nomeEscritorio) return null;

    try {
      await criarEscritorioEPerfil(supabase, user.id, nomeUsuario, nomeEscritorio);
    } catch (erro) {
      // Não deixa o onboarding adiado derrubar o layout inteiro com um erro
      // não tratado (contrato documentado desta função é retornar `null`
      // quando não é possível resolver/criar o perfil) — mas registra a
      // causa real, senão o usuário fica preso num loop de redirect para
      // /login sem nenhum rastro do motivo real no server.
      console.error(
        "[current-user/getUsuarioAtual] Falha ao concluir onboarding pós-confirmação de e-mail:",
        erro,
        { userId: user.id },
      );
      return null;
    }

    const segundaTentativa = await supabase
      .from("perfis")
      .select("*, escritorio:escritorios(*)")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (segundaTentativa.error) {
      console.error(
        "[current-user/getUsuarioAtual] Falha ao rebuscar perfil pós-onboarding:",
        segundaTentativa.error,
        { userId: user.id },
      );
      return null;
    }
    if (!segundaTentativa.data) return null;
    perfilComEscritorio = segundaTentativa.data;
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    perfil: perfilComEscritorio as unknown as PerfilAtual,
  };
});
