import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { autorizarChamadaCron } from "@/lib/cron/autorizar";

export const maxDuration = 30;

// Documento fica "processando" enquanto `after()` (ver
// app/app/base-conhecimento/actions.ts) extrai texto + gera embeddings em
// background. Se a lambda for encerrada no meio disso (PDF grande demais,
// estourou o `maxDuration` da rota de upload), a linha nunca chega no
// `catch`/`finally` que marcaria "erro" — fica presa em "processando" pra
// sempre, sem qualquer sinal pro usuário de que precisa reenviar. Este
// watchdog varre 1x/dia e marca como erro qualquer documento que passou
// tempo demais nesse estado.
const LIMITE_HORAS_PROCESSANDO = 2;

/**
 * Chamado 1x/dia pelo Vercel Cron (ver `vercel.json`). Mesmo padrão de
 * proteção dos demais crons: exige `Authorization: Bearer ${CRON_SECRET}`.
 */
export async function GET(request: NextRequest) {
  const auth = autorizarChamadaCron(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  try {
    const supabase = createAdminClient();
    const limite = new Date(Date.now() - LIMITE_HORAS_PROCESSANDO * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("documentos_conhecimento")
      .update({
        status: "erro",
        erro: `Processamento não concluído em ${LIMITE_HORAS_PROCESSANDO}h (função em background provavelmente foi encerrada) — reenvie o arquivo.`,
      })
      .eq("status", "processando")
      .lt("criado_em", limite)
      .select("id");

    if (error) throw error;

    return NextResponse.json({ ok: true, marcadosComoErro: data?.length ?? 0 });
  } catch (erro) {
    return NextResponse.json(
      { ok: false, error: erro instanceof Error ? erro.message : "Erro desconhecido ao limpar documentos travados." },
      { status: 500 },
    );
  }
}
