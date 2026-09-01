import "server-only";

import { createClient } from "@/lib/supabase/server";
import { mesReferencia } from "@/lib/ia/registro-uso";
import {
  PRECOS_POR_MILHAO,
  TETO_CUSTO_USD_PRO_MES,
  agruparCustoPorEscritorio,
  type RegistroUsoIaComEscritorio,
} from "@/lib/uso/agregar";

export type EscritorioExcedente = {
  escritorioId: string;
  escritorioNome: string;
  totalUsd: number;
  registrosPrecificados: number;
  registrosTotal: number;
  percentualDoTeto: number;
};

type LinhaUsoIaAdmin = {
  escritorio_id: string;
  criado_em: string;
  mes_ref: string;
  tokens_in: number;
  tokens_out: number;
  duracao_ms: number | null;
  modelo: string | null;
  origem: string | null;
  escritorio: { nome: string; plano: "free" | "pro" } | { nome: string; plano: "free" | "pro" }[] | null;
};

/** Normaliza a relação `escritorio` do Supabase (objeto único ou array,
 * dependendo da versão do client/tipo de FK) num único objeto ou null. */
function primeiroEscritorio(
  valor: LinhaUsoIaAdmin["escritorio"],
): { nome: string; plano: "free" | "pro" } | null {
  if (!valor) return null;
  return Array.isArray(valor) ? (valor[0] ?? null) : valor;
}

/**
 * Alerta técnico de uso razoável (Fase 5): lista escritórios do plano Pro
 * cujo CUSTO ESTIMADO de IA no mês corrente passou de `TETO_CUSTO_USD_PRO_MES`.
 * Calculado SOB DEMANDA a partir de `uso_ia` (sem tabela nova) — visibilidade
 * interna só para o admin da plataforma, NUNCA usado para bloquear ou
 * degradar o escritório (o plano Pro continua "sem limite mensal de IA" na
 * prática; ver `app/admin/uso-excedente/page.tsx` e a cláusula de uso
 * razoável em `app/termos/page.tsx`).
 *
 * Depende da RLS policy `uso_ia_select_admin_plataforma` (migration 0055)
 * para enxergar linhas de `uso_ia` fora do próprio escritório do admin.
 */
export async function listarEscritoriosProExcedentes(
  referencia = new Date(),
): Promise<EscritorioExcedente[]> {
  const supabase = await createClient();
  const mesAtual = mesReferencia(referencia);

  const { data, error } = await supabase
    .from("uso_ia")
    .select(
      "escritorio_id, criado_em, mes_ref, tokens_in, tokens_out, duracao_ms, modelo, origem, escritorio:escritorios(nome, plano)",
    )
    .eq("mes_ref", mesAtual)
    .returns<LinhaUsoIaAdmin[]>();

  if (error) throw error;

  const nomePorEscritorio = new Map<string, string>();
  const registrosPro: RegistroUsoIaComEscritorio[] = [];

  for (const linha of data ?? []) {
    const escritorio = primeiroEscritorio(linha.escritorio);
    if (!escritorio || escritorio.plano !== "pro") continue;

    nomePorEscritorio.set(linha.escritorio_id, escritorio.nome);
    registrosPro.push({
      escritorio_id: linha.escritorio_id,
      criado_em: linha.criado_em,
      mes_ref: linha.mes_ref,
      tokens_in: linha.tokens_in,
      tokens_out: linha.tokens_out,
      duracao_ms: linha.duracao_ms,
      modelo: linha.modelo,
      origem: linha.origem,
    });
  }

  const custosPorEscritorio = agruparCustoPorEscritorio(registrosPro, PRECOS_POR_MILHAO);

  return custosPorEscritorio
    .filter((c): c is typeof c & { totalUsd: number } => c.totalUsd !== null && c.totalUsd > TETO_CUSTO_USD_PRO_MES)
    .map((c) => ({
      escritorioId: c.escritorioId,
      escritorioNome: nomePorEscritorio.get(c.escritorioId) ?? "—",
      totalUsd: c.totalUsd,
      registrosPrecificados: c.registrosPrecificados,
      registrosTotal: c.registrosTotal,
      percentualDoTeto: Math.round((c.totalUsd / TETO_CUSTO_USD_PRO_MES) * 100),
    }))
    .sort((a, b) => b.totalUsd - a.totalUsd);
}
