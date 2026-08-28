import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { autenticarApiKey } from "@/lib/apikeys/autenticar";
import { escritorioTemAcessoApiPublica } from "@/lib/apikeys/verificar-acesso";
import { parsearPaginacao } from "@/lib/apikeys/paginacao";
import { verificarRateLimit } from "@/lib/rate-limit";

const MAX_TENTATIVAS_API = 60;
const JANELA_API_MS = 60 * 1000; // 1 minuto

/**
 * GET /api/v1/prazos — lista os prazos do escritório dono da API key.
 *
 * Auth: header `Authorization: Bearer <chave>` (ver lib/apikeys/autenticar.ts).
 * Query params: `limit` (padrão 20, máx 100), `offset` (padrão 0),
 *   `concluido` opcional (`true`/`false` — filtra por status; ausente = todos).
 * Resposta 200: `{ data: Prazo[], pagination: { limit, offset, total } }`, onde
 *   Prazo = { id, fichaCasoId, descricao, dataPrazo, concluido }.
 * Erros: 401 (sem chave ou chave inválida/revogada), 403 (escritório sem a
 *   feature "api_integracoes" no plano atual).
 *
 * NUNCA retorna dado de outro escritório: o `escritorio_id` da query vem
 * exclusivamente do resultado de `autenticarApiKey`, nunca de um parâmetro
 * controlado pelo cliente da API.
 */
export async function GET(request: NextRequest) {
  const auth = await autenticarApiKey(request);
  if (!auth.ok) {
    return NextResponse.json({ error: "Chave de API ausente ou inválida." }, { status: 401 });
  }

  const permitido = await verificarRateLimit(`api-v1:${auth.escritorioId}`, {
    maxTentativas: MAX_TENTATIVAS_API,
    janelaMs: JANELA_API_MS,
  });
  if (!permitido) {
    return NextResponse.json({ error: "Limite de requisições excedido. Tente novamente em instantes." }, { status: 429 });
  }

  const temAcesso = await escritorioTemAcessoApiPublica(auth.escritorioId, "api_integracoes");
  if (!temAcesso) {
    return NextResponse.json(
      { error: "Este escritório não tem acesso à API/integrações no plano atual." },
      { status: 403 },
    );
  }

  const { limit, offset } = parsearPaginacao(request.nextUrl.searchParams);
  const concluidoParam = request.nextUrl.searchParams.get("concluido");

  const supabase = createAdminClient();
  let query = supabase
    .from("prazos")
    .select("id, ficha_caso_id, descricao, titulo, data_prazo, concluido", { count: "exact" })
    .eq("escritorio_id", auth.escritorioId);

  if (concluidoParam === "true") query = query.eq("concluido", true);
  else if (concluidoParam === "false") query = query.eq("concluido", false);

  const { data, error, count } = await query.order("data_prazo", { ascending: true }).range(offset, offset + limit - 1);

  if (error) {
    console.error("[api/v1/prazos] Falha ao consultar prazos:", error, { escritorioId: auth.escritorioId });
    return NextResponse.json({ error: "Falha ao consultar prazos." }, { status: 500 });
  }

  return NextResponse.json({
    data: (data ?? []).map((linha) => ({
      id: linha.id,
      fichaCasoId: linha.ficha_caso_id,
      // `titulo` é o campo obrigatório no schema (0001); `descricao` pode ser
      // nulo — expõe os dois como fallback pra API pública sempre ter algum
      // texto descritivo mesmo em prazos antigos que só preencheram título.
      descricao: linha.descricao ?? linha.titulo,
      dataPrazo: linha.data_prazo,
      concluido: linha.concluido,
    })),
    pagination: { limit, offset, total: count ?? 0 },
  });
}
