import "server-only";

import type { createClient } from "@/lib/supabase/server";
import type { DadosFichaParaPeca } from "./prompt";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type FichaRow = {
  id: string;
  nome_cliente: string | null;
  area_direito: string | null;
  resumo_fatos: string | null;
  urgencia: "baixa" | "normal" | "alta";
};

export type ResultadoCarregarFicha =
  | { ok: true; dados: DadosFichaParaPeca }
  | { ok: false; error: string };

/**
 * Busca a ficha (+ prazo/contrato mais recentes vinculados, mesmo raciocínio
 * do mail-merge em `gerar-documento-ficha.ts`) e monta `DadosFichaParaPeca`
 * pronto para `montarPromptPeca`. Extraído de `pecas-actions.ts` (Fase de
 * streaming da redação assistida) para ser reaproveitado tanto pela rota SSE
 * (`app/api/pecas/gerar/route.ts`) quanto por qualquer outro caller futuro —
 * sem duplicar a query nem a checagem de "ficha não encontrada".
 *
 * Não faz gate de plano nem autenticação — isso é responsabilidade do
 * caller, ANTES de chamar esta função (mesma ordem de sempre: auth → gate de
 * plano → I/O).
 */
export async function carregarDadosFichaParaPeca(
  supabase: SupabaseServerClient,
  fichaId: string,
): Promise<ResultadoCarregarFicha> {
  const { data: fichaData, error: erroFicha } = await supabase
    .from("fichas_caso")
    .select("id, nome_cliente, area_direito, resumo_fatos, urgencia")
    .eq("id", fichaId)
    .maybeSingle();

  if (erroFicha || !fichaData) return { ok: false, error: "Ficha não encontrada." };
  const ficha = fichaData as FichaRow;

  const [{ data: prazoComProcesso }, { data: contrato }] = await Promise.all([
    supabase
      .from("prazos")
      .select("numero_processo_cnj")
      .eq("ficha_caso_id", fichaId)
      .not("numero_processo_cnj", "is", null)
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle<{ numero_processo_cnj: string | null }>(),
    supabase
      .from("contratos_honorario")
      .select("valor_total")
      .eq("ficha_caso_id", fichaId)
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle<{ valor_total: number | null }>(),
  ]);

  return {
    ok: true,
    dados: {
      nomeCliente: ficha.nome_cliente,
      areaDireito: ficha.area_direito,
      resumoFatos: ficha.resumo_fatos,
      urgencia: ficha.urgencia,
      numeroProcessoCnj: prazoComProcesso?.numero_processo_cnj ?? null,
      valorCausa: contrato?.valor_total ?? null,
    },
  };
}
