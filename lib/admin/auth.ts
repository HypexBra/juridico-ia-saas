import "server-only";

import { cache } from "react";
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
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
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
