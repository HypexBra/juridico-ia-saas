import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { autorizarChamadaCron } from "@/lib/cron/autorizar";
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
 *
 * Hoje a sincronização do STJ também roda dentro do job diário
 * (`/api/cron/atualizar-base-juridica`, via `lib/rag/fontes-diarias.ts`), que
 * é o que está agendado no `vercel.json`. Esta rota continua existindo como
 * gatilho MANUAL/isolado: rodar só o STJ sem esperar a janela diária, e sem
 * arrastar o DJEN junto.
 */
export async function POST(request: NextRequest) {
  let autorizado = autorizarChamadaCron(request).ok;
  if (!autorizado) {
    // Trigger manual: admin de PLATAFORMA autenticado (mesmo gate de /admin).
    // Owner de escritório NÃO basta aqui — o job consome infra/custo
    // compartilhado entre todos os tenants, não só o do escritório dele.
    try {
      const { getAdminAtual } = await import("@/lib/admin/auth");
      const admin = await getAdminAtual();
      autorizado = Boolean(admin);
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

/**
 * O Vercel Cron dispara sempre GET · nunca POST. Enquanto esta rota só
 * exportava POST, a entrada `/api/cron/sync-stj` do `vercel.json` respondia
 * 405 em toda execução agendada, e o único sync que aconteceu de fato foi o
 * manual (ver PENDENCIAS.md §1.3). O agendamento hoje é do job diário, mas o
 * GET fica exportado para que um disparo por URL (curl/painel) funcione sem
 * precisar montar um POST.
 */
export const GET = POST;
