import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processarLembretesWhatsapp } from "@/lib/whatsapp/lembretes";

export const maxDuration = 60;

/**
 * Chamado 1x/dia pelo Vercel Cron (ver `vercel.json`). Mesmo padrão de
 * proteção de `app/api/cron/sincronizar-djen/route.ts`: exige
 * `Authorization: Bearer ${CRON_SECRET}`, que o Vercel Cron injeta
 * automaticamente quando a env var está configurada — qualquer chamada sem
 * o secret certo é rejeitada antes de tocar no banco ou na Meta Cloud API.
 *
 * Usa `createAdminClient` (service_role) porque precisa iterar todos os
 * escritórios com canal WhatsApp ativo, não só o de um usuário logado.
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
    const resumo = await processarLembretesWhatsapp(supabase);

    return NextResponse.json({
      ok: true,
      candidatos: resumo.candidatos,
      jaEnviadosAntes: resumo.jaEnviadosAntes,
      enviadosAgora: resumo.enviadosAgora,
      falharam: resumo.falharam,
    });
  } catch (erro) {
    // Nunca deixa uma falha (ex: Meta Cloud API fora do ar, banco
    // indisponível) derrubar a Route Handler sem resposta — reporta 500
    // controlado, que o Vercel Cron registra como execução falha e loga.
    return NextResponse.json(
      { ok: false, error: erro instanceof Error ? erro.message : "Erro desconhecido nos lembretes WhatsApp." },
      { status: 500 },
    );
  }
}
