import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { autenticarApiKey } from "@/lib/apikeys/autenticar";
import { escritorioTemAcessoApiPublica } from "@/lib/apikeys/verificar-acesso";
import { parsearPaginacao } from "@/lib/apikeys/paginacao";

/**
 * GET /api/v1/fichas — lista as fichas de caso do escritório dono da API key.
 *
 * Auth: header `Authorization: Bearer <chave>` (ver lib/apikeys/autenticar.ts).
 * Query params: `limit` (padrão 20, máx 100), `offset` (padrão 0).
 * Resposta 200: `{ data: Ficha[], pagination: { limit, offset, total } }`, onde
 *   Ficha = { id, nomeCliente, areaDireito, urgencia, criadoEm }.
 * Erros: 401 (sem chave ou chave inválida/revogada), 403 (escritório sem a
 *   feature "api_integracoes" no plano atual — mesmo com chave válida).
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

  const temAcesso = await escritorioTemAcessoApiPublica(auth.escritorioId, "api_integracoes");
  if (!temAcesso) {
    return NextResponse.json(
      { error: "Este escritório não tem acesso à API/integrações no plano atual." },
      { status: 403 },
    );
  }

  const { limit, offset } = parsearPaginacao(request.nextUrl.searchParams);

  const supabase = createAdminClient();
  const { data, error, count } = await supabase
    .from("fichas_caso")
    .select("id, nome_cliente, area_direito, urgencia, criado_em", { count: "exact" })
    .eq("escritorio_id", auth.escritorioId)
    .order("criado_em", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("[api/v1/fichas] Falha ao consultar fichas:", error, { escritorioId: auth.escritorioId });
    return NextResponse.json({ error: "Falha ao consultar fichas." }, { status: 500 });
  }

  return NextResponse.json({
    data: (data ?? []).map((linha) => ({
      id: linha.id,
      nomeCliente: linha.nome_cliente,
      areaDireito: linha.area_direito,
      urgencia: linha.urgencia,
      criadoEm: linha.criado_em,
    })),
    pagination: { limit, offset, total: count ?? 0 },
  });
}
