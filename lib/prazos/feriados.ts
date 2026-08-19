import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adicionarDias, formatarDataISO, paraDataUtc } from "./calculo";
import type { FeriadoForense } from "./calculadora";

/**
 * Janela de busca generosa em `feriados_forenses`: mesmo no pior caso (prazo
 * grande + dobra + parte contrária Fazenda Pública, ex: 60 dias úteis * 2 =
 * 120 dias úteis) a data final nunca deveria ultrapassar ~1 ano corrido de
 * distância da intimação, então 400 dias corridos é margem confortável sem
 * precisar carregar a tabela inteira a cada cálculo.
 */
const JANELA_DIAS_CORRIDOS = 400;

/**
 * Busca em `feriados_forenses` os feriados relevantes para um cálculo de
 * prazo: nacionais (sempre) + estaduais da UF informada, dentro de uma
 * janela a partir da data de intimação. Único ponto de I/O desta feature —
 * `lib/prazos/calculadora.ts` permanece pura e recebe o resultado já
 * carregado.
 */
export async function buscarFeriadosRelevantes(
  supabase: SupabaseClient,
  dataIntimacao: string | Date,
  uf: string | null,
): Promise<FeriadoForense[]> {
  const inicio = paraDataUtc(dataIntimacao);
  const fim = adicionarDias(inicio, JANELA_DIAS_CORRIDOS);
  const ufNormalizada = uf ? uf.trim().toUpperCase() : null;

  const filtroAbrangencia = ufNormalizada
    ? `abrangencia.eq.nacional,and(abrangencia.eq.estadual,uf.eq.${ufNormalizada})`
    : "abrangencia.eq.nacional";

  const { data, error } = await supabase
    .from("feriados_forenses")
    .select("data, abrangencia, uf, descricao")
    .gte("data", formatarDataISO(inicio))
    .lte("data", formatarDataISO(fim))
    .or(filtroAbrangencia)
    .returns<FeriadoForense[]>();

  if (error) {
    console.error("[buscarFeriadosRelevantes] falha ao consultar feriados_forenses:", error, {
      dataIntimacao: formatarDataISO(inicio),
      uf: ufNormalizada,
    });
    // Falha de leitura de feriado não pode travar o cálculo do prazo — a
    // camada de aplicação segue sem pular feriado nenhum (pior caso é uma
    // sugestão conservadora a mais, nunca menos dias que o real), mas o
    // usuário sempre pode ajustar a data manualmente.
    return [];
  }

  return data ?? [];
}
