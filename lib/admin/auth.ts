import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { PlataformaAdmin } from "@/lib/types";

export type AdminAtual = {
  userId: string;
  email: string | null;
  admin: PlataformaAdmin;
};

/**
 * Resolve o admin da plataforma autenticado (ver docs/adrs/0003-admin-plataforma.md).
 * Retorna `null` para: sem sessão, sem linha em `plataforma_admins`, ou
 * admin desativado — todo caller (layout/page/action de /admin) deve tratar
 * `null` como acesso negado (nunca assumir que "sem erro" = autorizado).
 *
 * A checagem em si já é reforçada no banco (RLS `plataforma_admins_self_select`
 * só deixa ler a PRÓPRIA linha) — isto aqui é o guard de aplicação que
 * espelha essa regra, nunca o único lugar onde a autorização é decidida.
 */
export const getAdminAtual = cache(async (): Promise<AdminAtual | null> => {
  const supabase = await createClient();

  // Mesmo fast path de `lib/app/current-user.ts`: o middleware já validou a
  // sessão e injetou id+email via header — evita repetir aqui o round-trip
  // de rede que `auth.getUser()` faz ao Supabase Auth, chamado em TODA
  // navegação de /app (via app/app/layout.tsx), admin ou não.
  const requestHeaders = await headers();
  const userIdDoHeader = requestHeaders.get("x-user-id");
  const userEmailDoHeader = requestHeaders.get("x-user-email");

  let user: { id: string; email?: string | null } | null = userIdDoHeader
    ? { id: userIdDoHeader, email: userEmailDoHeader }
    : null;

  if (!user) {
    const { data: userData } = await supabase.auth.getUser();
    user = userData.user;
  }
  if (!user) return null;

  const { data: admin, error } = await supabase
    .from("plataforma_admins")
    .select("*")
    .eq("auth_user_id", user.id)
    .eq("ativo", true)
    .maybeSingle<PlataformaAdmin>();

  if (error) {
    console.error("[admin/auth] Falha ao checar plataforma_admins:", error, { userId: user.id });
    return null;
  }
  if (!admin) return null;

  return { userId: user.id, email: user.email ?? null, admin };
});
