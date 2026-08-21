"use server";

import { revalidatePath } from "next/cache";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { planoTemAcesso } from "@/lib/planos/gating";
import { gerarResposta } from "@/lib/ia/provider";
import { montarPromptPeca, type DadosFichaParaPeca } from "@/lib/pecas/prompt";
import { ehTipoPecaValido, type TipoPeca } from "@/lib/pecas/tipos";

type FichaRow = {
  id: string;
  nome_cliente: string | null;
  area_direito: string | null;
  resumo_fatos: string | null;
  urgencia: "baixa" | "normal" | "alta";
};

export type GerarPecaCompletaResultado =
  | { ok: true; conteudoGerado: string; modeloIaUsado: string }
  | { ok: false; error: string };

/**
 * Redação assistida de peças completas (feature Pro "redacao_assistida_pecas",
 * migration 0016) — diferente de `gerarPeticaoDeModeloAction` (mail-merge
 * literal do plano free, `app/app/fichas/actions.ts`), aqui a IA REDIGE a
 * peça inteira a partir dos fatos da ficha, sem modelo/template.
 *
 * Gate de plano é a PRIMEIRA coisa checada, antes de qualquer busca de dados
 * ou chamada de IA — nunca gastar uma chamada cara de LLM para depois
 * descobrir que o escritório não tem acesso.
 */
export async function gerarPecaCompletaAction(
  fichaId: string,
  tipoPeca: string,
  instrucoesExtras: string,
): Promise<GerarPecaCompletaResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  if (!planoTemAcesso(usuario.perfil.escritorio, "redacao_assistida_pecas")) {
    return { ok: false, error: "Redação assistida de peças completas é um recurso do plano Pro." };
  }

  if (!ehTipoPecaValido(tipoPeca)) {
    return { ok: false, error: "Tipo de peça inválido." };
  }

  const supabase = await createClient();
  const { data: fichaData, error: erroFicha } = await supabase
    .from("fichas_caso")
    .select("id, nome_cliente, area_direito, resumo_fatos, urgencia")
    .eq("id", fichaId)
    .maybeSingle();

  if (erroFicha || !fichaData) return { ok: false, error: "Ficha não encontrada." };
  const ficha = fichaData as FichaRow;

  // Mesmo raciocínio de "prazo/contrato mais recente vinculado à ficha" já
  // usado no mail-merge (`gerar-documento-ficha.ts`) — reaproveitado aqui
  // como contexto opcional para a IA, sem bloquear a geração quando ausente.
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

  const dadosFicha: DadosFichaParaPeca = {
    nomeCliente: ficha.nome_cliente,
    areaDireito: ficha.area_direito,
    resumoFatos: ficha.resumo_fatos,
    urgencia: ficha.urgencia,
    numeroProcessoCnj: prazoComProcesso?.numero_processo_cnj ?? null,
    valorCausa: contrato?.valor_total ?? null,
  };

  const prompt = montarPromptPeca({
    tipoPeca: tipoPeca as TipoPeca,
    ficha: dadosFicha,
    instrucoesExtras: instrucoesExtras.trim() || null,
  });

  let respostaIa;
  try {
    respostaIa = await gerarResposta([{ role: "user", conteudo: prompt }]);
  } catch (erro) {
    console.error("[fichas/pecas-actions] Falha ao gerar peça completa via IA:", erro, { fichaId, tipoPeca });
    return { ok: false, error: "A IA está indisponível no momento. Tente novamente em instantes." };
  }

  if (!respostaIa.texto.trim()) {
    // Nunca devolve/grava resposta vazia como se fosse uma peça válida —
    // trata como falha explícita da IA, não como "peça em branco".
    return { ok: false, error: "A IA não conseguiu gerar a peça. Tente novamente ou ajuste as instruções." };
  }

  // Nome do modelo de fato usado não é retornado por `gerarResposta` hoje
  // (o fallback Gemini->Groq é transparente para o caller, ver
  // lib/ia/provider.ts) — "gemini/groq (fallback automático)" documenta
  // honestamente essa incerteza em vez de fingir precisão que não existe.
  const modeloIaUsado = "gemini-flash-latest (fallback: groq)";

  const { error: erroInsercao } = await supabase.from("pecas_geradas").insert({
    escritorio_id: usuario.perfil.escritorio_id,
    ficha_caso_id: fichaId,
    tipo_peca: tipoPeca,
    instrucoes_extras: instrucoesExtras.trim() || null,
    conteudo_gerado: respostaIa.texto,
    modelo_ia_usado: modeloIaUsado,
    criado_por: usuario.perfil.id,
  });

  if (erroInsercao) {
    console.error("[fichas/pecas-actions] Falha ao registrar peça gerada:", erroInsercao, { fichaId, tipoPeca });
    return {
      ok: false,
      error: "A peça foi gerada, mas houve um erro ao registrar a auditoria. Tente novamente.",
    };
  }

  await supabase.from("uso_ia").insert({
    escritorio_id: usuario.perfil.escritorio_id,
    tokens_in: respostaIa.tokensIn,
    tokens_out: respostaIa.tokensOut,
    mes_ref: new Date().toISOString().slice(0, 7),
  });

  revalidatePath(`/app/fichas/${fichaId}`);

  return { ok: true, conteudoGerado: respostaIa.texto, modeloIaUsado };
}
