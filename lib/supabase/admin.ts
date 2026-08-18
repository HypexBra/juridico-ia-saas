import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase com `service_role` — só para rotas server-to-server sem
 * sessão de usuário (ex: webhook do Autentique, cron job de sincronização
 * DJEN em `app/api/cron/sincronizar-djen`), onde não há `auth.uid()` pra RLS
 * resolver `escritorio_atual()`. Nunca importar isso em código que roda a
 * partir de uma requisição de usuário autenticado: o cliente normal
 * (`lib/supabase/server.ts`) já aplica RLS corretamente e é sempre
 * preferível — este bypassa todas as policies, então todo insert/select
 * feito com ele precisa filtrar/gravar `escritorio_id` manualmente.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não configurada. Necessária para operações server-to-server sem sessão de usuário (webhook de assinatura, cron do DJEN).",
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
