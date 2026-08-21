import "server-only";

import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calcularHashApiKey } from "@/lib/apikeys/gerar";

export type AutenticacaoApiKey =
  | { ok: true; escritorioId: string; apiKeyId: string }
  | { ok: false; motivo: "sem_chave" | "chave_invalida" };

/**
 * Extrai a API key do header `Authorization: Bearer <chave>` e resolve o
 * `escritorio_id` dono dela. Roda com `service_role`
 * (`createAdminClient()`) porque a requisição não tem sessão de usuário do
 * Supabase Auth — nada aqui pode depender de `escritorio_atual()`/RLS.
 *
 * Não vaza timing information relevante: a busca é por `chave_hash` via
 * índice único (`api_keys.chave_hash`), nunca uma comparação de string da
 * chave em si — o próprio Postgres já resolve isso em tempo essencialmente
 * constante do ponto de vista de um atacante remoto.
 *
 * IMPORTANTE: retornar `escritorioId` aqui NÃO significa que o escritório
 * ainda tem acesso à feature "api_integracoes" — o escritório pode ter
 * caído para o plano Free depois de gerar a chave. Cada rota de
 * `app/api/v1/*` precisa revalidar `escritorioTemAcesso(escritorioId,
 * "api_integracoes")` separadamente, a cada request.
 */
export async function autenticarApiKey(request: NextRequest): Promise<AutenticacaoApiKey> {
  const header = request.headers.get("authorization");
  const chaveCompleta = extrairChaveDoHeader(header);
  if (!chaveCompleta) return { ok: false, motivo: "sem_chave" };

  const chaveHash = calcularHashApiKey(chaveCompleta);
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("api_keys")
    .select("id, escritorio_id, ativa")
    .eq("chave_hash", chaveHash)
    .maybeSingle<{ id: string; escritorio_id: string; ativa: boolean }>();

  if (error || !data || !data.ativa) {
    return { ok: false, motivo: "chave_invalida" };
  }

  // Best-effort: não bloqueia a resposta da API por causa de uma falha ao
  // registrar o "último uso" — é um dado de auditoria/UX, não de segurança.
  void supabase
    .from("api_keys")
    .update({ ultima_utilizacao_em: new Date().toISOString() })
    .eq("id", data.id)
    .then(({ error: erroAtualizacao }) => {
      if (erroAtualizacao) {
        console.error("[apikeys/autenticar] Falha ao atualizar ultima_utilizacao_em:", erroAtualizacao, {
          apiKeyId: data.id,
        });
      }
    });

  return { ok: true, escritorioId: data.escritorio_id, apiKeyId: data.id };
}

function extrairChaveDoHeader(header: string | null): string | null {
  if (!header) return null;
  const [esquema, valor] = header.split(" ");
  if (esquema?.toLowerCase() !== "bearer" || !valor) return null;
  return valor.trim() || null;
}
