"use server";

import { z } from "zod";
import { Type, type Schema } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { planoTemAcesso } from "@/lib/planos/gating";
import { gerarRespostaEstruturada } from "@/lib/ia/chamada-estruturada";
import { verificarCitacoes, type CitacaoVerificada } from "@/lib/jurisprudencia/verificacao";
import { buscarJurisprudenciaPorIds } from "@/lib/jurisprudencia/busca";

const textoSchema = z.object({
  texto: z.string().trim().min(10, "Cole o texto a verificar.").max(60_000, "Texto muito longo."),
});

export type VerificacaoResultado =
  | { ok: true; citacoes: CitacaoVerificada[] }
  | { ok: false; error: string };

/**
 * Verifica as citações jurídicas de um texto contra a base local
 * (`jurisprudencias`). Usada pela aba "Verificar citações" da Pesquisa e
 * disponível para qualquer fluxo que exiba texto jurídico gerado por IA.
 */
export async function verificarCitacoesAction(input: z.infer<typeof textoSchema>): Promise<VerificacaoResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const parsed = textoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();
  const citacoes = await verificarCitacoes(supabase, parsed.data.texto);
  return { ok: true, citacoes };
}

// ── Comparador de decisões (análise por IA — Pro) ───────────────────────────

const COMPARACAO_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    resumoComparativo: { type: Type.STRING },
    tesesEmComum: { type: Type.ARRAY, items: { type: Type.STRING } },
    divergencias: { type: Type.ARRAY, items: { type: Type.STRING } },
    tendencia: { type: Type.STRING },
    riscos: { type: Type.ARRAY, items: { type: Type.STRING } },
    recomendacao: { type: Type.STRING },
  },
  required: [
    "resumoComparativo",
    "tesesEmComum",
    "divergencias",
    "tendencia",
    "riscos",
    "recomendacao",
  ],
  propertyOrdering: [
    "resumoComparativo",
    "tesesEmComum",
    "divergencias",
    "tendencia",
    "riscos",
    "recomendacao",
  ],
};

const CAMPOS_ANALISE_COMPARACAO = [
  "resumoComparativo",
  "tesesEmComum",
  "divergencias",
  "tendencia",
  "riscos",
  "recomendacao",
] as const;

export type AnaliseComparacaoDecisoes = {
  resumoComparativo: string;
  tesesEmComum: string[];
  divergencias: string[];
  tendencia: string;
  riscos: string[];
  recomendacao: string;
};

function parsearAnalise(jsonBruto: unknown): AnaliseComparacaoDecisoes | null {
  if (typeof jsonBruto !== "string") return null;
  try {
    const obj = JSON.parse(jsonBruto) as Record<string, unknown>;
    const campos: Record<string, unknown> = {};
    for (const campo of CAMPOS_ANALISE_COMPARACAO) {
      const valor = obj[campo];
      if (campo === "resumoComparativo" || campo === "tendencia" || campo === "recomendacao") {
        if (typeof valor !== "string" || !valor.trim()) return null;
      } else {
        if (!Array.isArray(valor) || !valor.every((v) => typeof v === "string")) return null;
      }
      campos[campo] = valor;
    }
    return campos as unknown as AnaliseComparacaoDecisoes;
  } catch {
    return null;
  }
}

/**
 * Comparação assistida por IA entre decisões selecionadas — feature Pro
 * (`pesquisa_juridica_avancada`, migration/gating desta fase). A comparação
 * ESTRUTURADA (tabela lado a lado com os metadados das decisões) é livre
 * para todo usuário autenticado; a síntese da IA é premium.
 */
export async function compararDecisoesAction(input: {
  ids: string[];
}): Promise<{ ok: true; analise: AnaliseComparacaoDecisoes } | { ok: false; error: string }> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };
  if (!planoTemAcesso(usuario.perfil.escritorio, "pesquisa_juridica_avancada")) {
    return { ok: false, error: "A análise comparativa por IA está disponível no plano Pro." };
  }

  const idsLimpos = input.ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 4);
  const supabase = await createClient();
  const registros = await buscarJurisprudenciaPorIds(supabase, idsLimpos);
  if (registros.length < 2) return { ok: false, error: "Selecione ao menos duas decisões para comparar." };

  const contexto = registros
    .map(
      (r, i) =>
        `DECISÃO ${i + 1}:\nTribunal: ${r.tribunal.toUpperCase()} | Classe: ${r.classe ?? "-"} | Nº processo: ${r.numero_processo}\nÓrgão: ${r.orgao_julgador ?? "-"} | Relator: ${r.relator ?? "-"} | Data julgamento: ${r.data_julgamento ?? "-"}${r.tema ? ` | Tema repetitivo: ${r.tema}` : ""}\nEMENTA:\n${r.ementa.slice(0, 4000)}`,
    )
    .join("\n\n---\n\n");

  try {
    const jsonBruto = await gerarRespostaEstruturada({
      promptTexto: contexto,
      parteExtra: null,
      systemPrompt:
        "Você é um analista jurisprudencial do Jurídico IA. Compare as decisões fornecidas APENAS com base no conteúdo delas (ementas e metadados). NUNCA invente precedentes, números de processo ou citações que não estejam nas ementas fornecidas. Quando algo não puder ser concluído com base nas ementas, diga explicitamente que os dados são insuficientes.",
      responseSchema: COMPARACAO_RESPONSE_SCHEMA,
      maxOutputTokens: 4096,
      thinkingBudget: 512,
      cadeiaModelos: ["gemini-flash-latest", "gemini-flash-lite-latest"],
      logPrefixo: "[pesquisa/comparar-decisoes]",
    });

    const analise = parsearAnalise(jsonBruto);
    if (!analise) return { ok: false, error: "A IA devolveu uma resposta em formato inesperado. Tente novamente." };
    return { ok: true, analise };
  } catch (erro) {
    console.error("[pesquisa/compararDecisoesAction] Falha na IA:", erro);
    return { ok: false, error: "Não foi possível gerar a comparação agora. Tente novamente em instantes." };
  }
}
