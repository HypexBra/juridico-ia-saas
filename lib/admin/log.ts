import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AdminAtual } from "@/lib/admin/auth";

/**
 * Registra uma ação administrativa em `admin_logs` (seção 10 do pedido:
 * auditoria). Best-effort de propósito — uma falha ao gravar o log nunca
 * deve impedir/reverter a ação administrativa em si (ex: já desativou o
 * usuário, não faz sentido falhar a request inteira só porque o INSERT do
 * log deu erro); só loga no console pra não passar despercebido.
 */
export async function registrarLogAdmin(
  admin: AdminAtual,
  params: {
    acao: string;
    alvoTipo?: string;
    alvoId?: string;
    detalhes?: Record<string, unknown>;
  },
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("admin_logs").insert({
    admin_id: admin.admin.id,
    admin_nome: admin.admin.nome,
    acao: params.acao,
    alvo_tipo: params.alvoTipo ?? null,
    alvo_id: params.alvoId ?? null,
    detalhes: params.detalhes ?? null,
  });

  if (error) {
    console.error("[admin/log] Falha ao registrar admin_logs:", error, { acao: params.acao });
  }
}
