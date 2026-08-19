import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { planoTemAcesso, type EscritorioParaGating, type FeaturePremium } from "@/lib/planos/gating";

/**
 * Mesma checagem de `escritorioTemAcesso` (lib/planos/gating.ts), mas para
 * uso em `app/api/v1/*`: aquela função busca `escritorios` pelo cliente
 * normal (RLS via `escritorio_atual()`), que depende de `auth.uid()` — e
 * uma requisição autenticada só por API key nunca tem sessão de cookie,
 * então `escritorio_atual()` sempre resolveria null ali e a checagem
 * falharia (fail-closed) mesmo para um escritório Pro legítimo. Por isso
 * esta versão lê com `service_role`, já que o `escritorioId` já veio
 * validado por `autenticarApiKey` (a chave em si prova a posse do
 * escritório, não é um dado arbitrário vindo do cliente).
 *
 * Fail-closed igual à original: qualquer erro/ausência de linha => false.
 */
export async function escritorioTemAcessoApiPublica(escritorioId: string, feature: FeaturePremium): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("escritorios")
    .select("plano, features_overrides")
    .eq("id", escritorioId)
    .maybeSingle<EscritorioParaGating>();

  if (error || !data) return false;
  return planoTemAcesso(data, feature);
}
