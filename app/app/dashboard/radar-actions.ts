"use server";

import { Type, type Schema } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { coletarSinaisRadar, classificarSinais, type SinalRadar } from "@/lib/radar/radar";
import { gerarRespostaEstruturada } from "@/lib/ia/chamada-estruturada";

export type BriefingRadar = {
  resumo: string;
  prioridades: string[];
  recomendacoes: string[];
};

const BRIEFING_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    resumo: { type: Type.STRING },
    prioridades: { type: Type.ARRAY, items: { type: Type.STRING } },
    recomendacoes: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["resumo", "prioridades", "recomendacoes"],
  propertyOrdering: ["resumo", "prioridades", "recomendacoes"],
};

// Modelo PRIMÁRIO da cadeia de briefing (mesmo alias de MODELO_FLASH em
// lib/ia/gemini.ts). Constante única usada na chamada E no registro de uso
// (Fase 27) para os dois nunca divergirem; o fallback por quota
// ("gemini-flash-lite-latest") pode assumir pontualmente e não é registrado.
const MODELO_PRINCIPAL_BRIEFING = "gemini-flash-latest";

function parsearBriefing(jsonBruto: unknown): BriefingRadar | null {
  if (typeof jsonBruto !== "string") return null;
  try {
    const obj = JSON.parse(jsonBruto) as Record<string, unknown>;
    if (typeof obj.resumo !== "string" || !obj.resumo.trim()) return null;
    if (!Array.isArray(obj.prioridades) || !obj.prioridades.every((v) => typeof v === "string")) return null;
    if (!Array.isArray(obj.recomendacoes) || !obj.recomendacoes.every((v) => typeof v === "string")) return null;
    return {
      resumo: obj.resumo,
      prioridades: obj.prioridades as string[],
      recomendacoes: obj.recomendacoes as string[],
    };
  } catch {
    return null;
  }
}

export type BriefingResultado =
  | { ok: true; briefing: BriefingRadar; sinais: SinalRadar[] }
  | { ok: false; error: string };

/**
 * Gera o briefing "O que preciso saber hoje?" — Fase 11 (IA Proativa).
 * Os sinais são SEMPRE determinísticos (queries reais); a IA só sintetiza
 * priorização e recomendação sobre eles. Cada geração consome 1 crédito de
 * `uso_ia` (mesma contagem das demais features de IA).
 */
export async function gerarBriefingRadarAction(): Promise<BriefingResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  const sinaisColetados = await coletarSinaisRadar(supabase);
  const sinaisClassificados = classificarSinais(sinaisColetados);

  if (sinaisClassificados.length === 0) {
    return {
      ok: true,
      briefing: {
        resumo: "Nenhum alerta ativo agora: prazos em dia, tarefas sem atraso e nenhuma pendência de comunicação.",
        prioridades: [],
        recomendacoes: [],
      },
      sinais: [],
    };
  }

  const contexto = sinaisClassificados
    .map((sinal, i) => `${i + 1}. [${sinal.severidade.toUpperCase()}] ${sinal.titulo} — ${sinal.detalhe}`)
    .join("\n");

  try {
    // Observabilidade (Fase 27): duração real da chamada estruturada.
    const inicioChamadaIaMs = Date.now();
    const jsonBruto = await gerarRespostaEstruturada({
      promptTexto: `SINAIS DO RADAR DO ESCRITÓRIO (dados reais de hoje):\n${contexto}`,
      parteExtra: null,
      systemPrompt:
        'Você é o copiloto de gestão do Jurídico IA. Produza um briefing matinal OBJETIVO para o advogado responsável, baseado EXCLUSIVAMENTE nos sinais fornecidos (são dados reais do banco). Regras: nunca invente prazos, clientes ou números que não estejam nos sinais; prioridades em ordem de risco jurídico (prazo perdido é irrecuperável); recomendações curtas e acionáveis; máximo 5 itens por lista; tom direto, sem adjetivação.',
      responseSchema: BRIEFING_RESPONSE_SCHEMA,
      maxOutputTokens: 2048,
      thinkingBudget: 256,
      cadeiaModelos: [MODELO_PRINCIPAL_BRIEFING, "gemini-flash-lite-latest"],
      logPrefixo: "[radar/briefing]",
    });
    const duracaoChamadaIaMs = Date.now() - inicioChamadaIaMs;

    const briefing = parsearBriefing(jsonBruto);
    if (!briefing) return { ok: false, error: "A IA devolveu uma resposta inesperada. Tente novamente." };

    // Contagem de uso mensal — mesma política das demais features de IA.
    // Fase 27: agora com modelo, duração e origem para a página /app/uso.
    await supabase.from("uso_ia").insert({
      escritorio_id: usuario.perfil.escritorio.id,
      mes_ref: new Date().toISOString().slice(0, 7),
      modelo: MODELO_PRINCIPAL_BRIEFING,
      duracao_ms: duracaoChamadaIaMs,
      origem: "radar_briefing",
    });

    return { ok: true, briefing, sinais: sinaisClassificados };
  } catch (erro) {
    console.error("[radar/gerarBriefing] Falha na IA:", erro);
    // FALLBACK DETERMINÍSTICO: a IA falhou, mas os sinais são reais — entrega
    // o radar bruto em vez de erro. O advogado não fica sem visão porque o
    // modelo está sobrecarregado.
    return {
      ok: true,
      briefing: {
        resumo: `${sinaisClassificados.length} alerta(s) ativo(s). (Síntese por IA indisponível neste momento — exibindo sinais diretos.)`,
        prioridades: sinaisClassificados.slice(0, 5).map((s) => `${s.titulo}: ${s.detalhe}`),
        recomendacoes: [],
      },
      sinais: sinaisClassificados,
    };
  }
}
