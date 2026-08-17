import "server-only";

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
 */
export async function getUsuarioAtual(): Promise<UsuarioAtual | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const primeiraTentativa = await supabase
    .from("perfis")
    .select("*, escritorio:escritorios(*)")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (primeiraTentativa.error) throw primeiraTentativa.error;

  let perfilComEscritorio = primeiraTentativa.data;

  if (!perfilComEscritorio) {
    const nomeUsuario = user.user_metadata?.nome_usuario as string | undefined;
    const nomeEscritorio = user.user_metadata?.nome_escritorio as string | undefined;
    if (!nomeUsuario || !nomeEscritorio) return null;

    await criarEscritorioEPerfil(supabase, user.id, nomeUsuario, nomeEscritorio);

    const segundaTentativa = await supabase
      .from("perfis")
      .select("*, escritorio:escritorios(*)")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (segundaTentativa.error || !segundaTentativa.data) return null;
    perfilComEscritorio = segundaTentativa.data;
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    perfil: perfilComEscritorio as unknown as PerfilAtual,
  };
}
