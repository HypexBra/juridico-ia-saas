import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sincronizarTodosEscritorios } from "@/lib/djen/sincronizar";

export const maxDuration = 60;

/**
 * Endpoint chamado 1x/dia pelo Vercel Cron (ver `vercel.json`). Protegido
 * por header `Authorization: Bearer ${CRON_SECRET}` — o Vercel Cron já
 * envia esse header automaticamente quando `CRON_SECRET` está configurado
 * nas env vars do projeto; qualquer chamada sem o secret certo é rejeitada
 * antes de tocar no DJEN ou no banco.
 *
 * Usa `createAdminClient` (service_role) porque não há sessão de usuário
 * neste contexto — precisa iterar TODOS os escritórios, não só o de um
 * usuário logado.
 */
export async function GET(request: NextRequest) {
  const secretEsperado = process.env.CRON_SECRET;
  if (!secretEsperado) {
    return NextResponse.json({ error: "CRON_SECRET não configurado no servidor." }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secretEsperado}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const resultados = await sincronizarTodosEscritorios(supabase);

    const totalPropostas = resultados.reduce((soma, r) => soma + r.propostasCriadas, 0);
    const falhas = resultados.filter((r) => !r.ok);

    return NextResponse.json({
      ok: true,
      oabsProcessadas: resultados.length,
      propostasCriadas: totalPropostas,
      falhas,
    });
  } catch (erro) {
    // Nunca deixa uma falha (ex: DJEN totalmente fora do ar, ou banco
    // indisponível) derrubar a Route Handler sem resposta — reporta 500
    // controlado, que o Vercel Cron registra como execução falha e loga.
    return NextResponse.json(
      { ok: false, error: erro instanceof Error ? erro.message : "Erro desconhecido na sincronização DJEN." },
      { status: 500 },
    );
  }
}
