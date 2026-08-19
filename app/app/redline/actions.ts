"use server";

import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { planoTemAcesso } from "@/lib/planos/gating";
import { gerarResposta } from "@/lib/ia/provider";
import {
  montarPromptRedline,
  parsearRespostaRedline,
  REDLINE_RESPONSE_SCHEMA,
  REDLINE_SYSTEM_PROMPT,
  TAMANHO_MAXIMO_CONTRATO,
} from "@/lib/redline/prompt";
import type { ResultadoAnaliseRisco } from "@/lib/redline/tipos";

export type AnalisarContratoResultado =
  | { ok: true; resultado: ResultadoAnaliseRisco }
  | { ok: false; error: string };

/**
 * Análise de risco contratual clause-by-clause (feature Pro
 * "analise_risco_contratual", migration 0017) — irmã de
 * `gerarPecaCompletaAction` (`app/app/fichas/[id]/pecas-actions.ts`), mesmo
 * padrão de gate de plano ANTES de qualquer I/O e de nunca salvar/exibir
 * resposta vazia/inválida da IA como se fosse uma análise real.
 *
 * Avulsa por decisão de v1: não recebe `fichaId` (a coluna
 * `ficha_caso_id` existe na migration para o futuro, mas esta action sempre
 * grava `null`) — ver comentário da migration 0017 e de `app/app/redline/page.tsx`.
 */
export async function analisarContratoAction(
  titulo: string,
  textoContrato: string,
): Promise<AnalisarContratoResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  if (!planoTemAcesso(usuario.perfil.escritorio, "analise_risco_contratual")) {
    return { ok: false, error: "Análise de risco contratual é um recurso do plano Pro." };
  }

  const textoLimpo = textoContrato.trim();
  if (!textoLimpo) {
    return { ok: false, error: "Cole o texto do contrato antes de analisar." };
  }
  if (textoLimpo.length > TAMANHO_MAXIMO_CONTRATO) {
    return {
      ok: false,
      error: `O contrato tem ${textoLimpo.length} caracteres — o limite atual é ${TAMANHO_MAXIMO_CONTRATO}. Analise o documento em partes.`,
    };
  }

  const tituloLimpo = titulo.trim() || null;
  const prompt = montarPromptRedline({ titulo: tituloLimpo, textoContrato: textoLimpo });

  let respostaIa;
  try {
    respostaIa = await gerarResposta([{ role: "user", conteudo: prompt }], {
      systemPromptOverride: REDLINE_SYSTEM_PROMPT,
      responseSchema: REDLINE_RESPONSE_SCHEMA,
    });
  } catch (erro) {
    console.error("[redline/actions] Falha ao chamar a IA para análise de contrato:", erro);
    return { ok: false, error: "A IA está indisponível no momento. Tente novamente em instantes." };
  }

  if (!respostaIa.texto.trim()) {
    // Mesmo cuidado de `gerarPecaCompletaAction`: nunca trata resposta vazia
    // como "contrato sem nenhum problema" — é falha explícita da IA.
    return { ok: false, error: "A IA não conseguiu analisar o contrato. Tente novamente." };
  }

  let bruto: unknown;
  try {
    bruto = JSON.parse(respostaIa.texto);
  } catch (erro) {
    console.error("[redline/actions] Resposta da IA não é JSON válido:", erro, {
      trechoResposta: respostaIa.texto.slice(0, 200),
    });
    return { ok: false, error: "A IA devolveu uma resposta em formato inesperado. Tente novamente." };
  }

  const resultado = parsearRespostaRedline(bruto);
  if (!resultado) {
    console.error("[redline/actions] Resposta da IA não bateu com o schema esperado.", {
      trechoResposta: respostaIa.texto.slice(0, 200),
    });
    return { ok: false, error: "A IA devolveu uma análise incompleta. Tente novamente." };
  }

  const supabase = await createClient();

  // Mesma incerteza documentada em `gerarPecaCompletaAction`: `gerarResposta`
  // não informa qual dos dois providers respondeu de fato.
  const modeloIaUsado = "gemini-flash-latest (fallback: groq)";

  const { error: erroInsercao } = await supabase.from("analises_risco_contratual").insert({
    escritorio_id: usuario.perfil.escritorio_id,
    ficha_caso_id: null,
    titulo: tituloLimpo,
    texto_contrato_analisado: textoLimpo,
    resultado_analise: resultado,
    modelo_ia_usado: modeloIaUsado,
    criado_por: usuario.perfil.id,
  });

  if (erroInsercao) {
    console.error("[redline/actions] Falha ao registrar análise de contrato:", erroInsercao);
    // A análise já foi gerada e é exibida mesmo assim — só a auditoria em
    // banco falhou, não faz sentido descartar o resultado que o usuário já
    // pagou (em custo de chamada de IA) para obter.
  }

  await supabase.from("uso_ia").insert({
    escritorio_id: usuario.perfil.escritorio_id,
    tokens_in: respostaIa.tokensIn,
    tokens_out: respostaIa.tokensOut,
    mes_ref: new Date().toISOString().slice(0, 7),
  });

  return { ok: true, resultado };
}
