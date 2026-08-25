import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sincronizarJurisprudenciaStj, type ResumoSyncOrgao } from "@/lib/jurisprudencia/stj";

export const dynamic = "force-dynamic";
// 10 órgãos × (metadados + download + upserts + embeddings) — teto generoso;
// na prática o cron mensal roda fora do horário de pico.
export const maxDuration = 300;

/**
 * Sincronização da jurisprudência STJ (Espelhos de Acórdão — dados abertos
 * oficiais, CC-BY). Disparado pelo Vercel Cron (mensal — os arquivos são
 * publicados por mês) ou manualmente por um admin autenticado.
 *
 * Idempotente: cada órgão só baixa/ingere um arquivo quando ele é MAIS
 * RECENTE que o último registrado em `fontes_stj_sync.ultimo_arquivo`
 * (migration 0042).
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  let autorizado = false;
  if (secret && authHeader === `Bearer ${secret}`) {
    autorizado = true;
  } else {
    // Trigger manual: admin autenticado via sessão (mesmo gate de /admin).
    try {
      const { getUsuarioAtual } = await import("@/lib/app/current-user");
      const usuario = await getUsuarioAtual();
      autorizado = Boolean(usuario?.perfil.escritorio.id) && usuario?.perfil.role === "owner";
    } catch {
      autorizado = false;
    }
  }

  if (!autorizado) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }

  const supabaseAdmin = createAdminClient();
  const resultados: ResumoSyncOrgao[] = await sincronizarJurisprudenciaStj(supabaseAdmin);

  const resumo = {
    orgaos: resultados.length,
    ok: resultados.filter((r) => r.status === "ok").length,
    pulados: resultados.filter((r) => r.status === "pulado").length,
    erros: resultados.filter((r) => r.status === "erro").length,
    registrosNovos: resultados.reduce((soma, r) => soma + (r.registrosNovos ?? 0), 0),
    detalhes: resultados,
    executadoEm: new Date().toISOString(),
  };

  console.error(JSON.stringify({ evento: "sync_stj_jurisprudencia", ...resumo, detalhes: undefined }));

  return Response.json(resumo);
}
