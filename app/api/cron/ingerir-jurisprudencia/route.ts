import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { autorizarChamadaCron } from "@/lib/cron/autorizar";
import { indexarJurisprudencias, jurisprudenciaInputSchema } from "@/lib/rag/jurisprudencia";

export const maxDuration = 60;

const bodySchema = z.object({
  itens: z.array(jurisprudenciaInputSchema).min(1).max(200),
});

/**
 * Endpoint de ingestão MANUAL de jurisprudência (STF/STJ) no RAG
 * compartilhado — ver comentário completo em lib/rag/jurisprudencia.ts sobre
 * por que não existe automação 1-clique: não foi encontrada nenhuma API
 * pública gratuita que devolva TEXTO de ementa pesquisável (DataJud só
 * cobre metadados processuais).
 *
 * Uso: POST com header `Authorization: Bearer ${CRON_SECRET}` (mesmo secret
 * do cron do DJEN — reaproveitado aqui por ser o único secret de
 * autenticação server-to-server já existente no projeto; ambos os usos são
 * "job administrativo sem sessão de usuário") e body:
 *   { "itens": [{ "tribunal": "stf", "numero_processo": "...", "ementa": "...", ... }] }
 *
 * Fonte dos itens: hoje, curadoria manual (ex: copiar ementas relevantes do
 * site de busca do STF/STJ para este JSON) ou uma exportação de planilha
 * convertida para este formato. Não é um scraper automático.
 */
export async function POST(request: NextRequest) {
  const auth = autorizarChamadaCron(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido: esperado JSON." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido.", detalhes: parsed.error.issues }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const resultados = await indexarJurisprudencias(supabase, parsed.data.itens);
    const falhas = resultados.filter((r) => !r.ok);

    return NextResponse.json({
      ok: falhas.length === 0,
      processados: resultados.length,
      falhas,
    });
  } catch (erro) {
    return NextResponse.json(
      { ok: false, error: erro instanceof Error ? erro.message : "Erro desconhecido na ingestão de jurisprudência." },
      { status: 500 },
    );
  }
}
