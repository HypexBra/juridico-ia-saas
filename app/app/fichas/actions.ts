"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { gerarResposta } from "@/lib/ia/provider";
import { classificarRiscoFicha } from "@/lib/ia/risco";
import { gerarDocumentoDaFicha } from "@/lib/peticoes/gerar-documento-ficha";
import { AREAS_DIREITO, LIMITE_MENSAGENS_FREE } from "@/lib/types";

const criarFichaSchema = z.object({
  nomeCliente: z.string().trim().min(1, "Informe o nome do cliente."),
  telefone: z.string().trim().optional(),
  areaDireito: z.enum(AREAS_DIREITO).optional(),
  resumoFatos: z.string().trim().min(1, "Descreva os fatos do caso."),
  urgencia: z.enum(["baixa", "normal", "alta"]),
});

export type CriarFichaState = { error: string | null };

export async function criarFichaAction(
  _prev: CriarFichaState,
  formData: FormData,
): Promise<CriarFichaState> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { error: "Sessão expirada. Faça login novamente." };

  const parsed = criarFichaSchema.safeParse({
    nomeCliente: formData.get("nomeCliente"),
    telefone: formData.get("telefone") || undefined,
    areaDireito: formData.get("areaDireito") || undefined,
    resumoFatos: formData.get("resumoFatos"),
    urgencia: formData.get("urgencia"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { data: ficha, error } = await supabase
    .from("fichas_caso")
    .insert({
      escritorio_id: usuario.perfil.escritorio_id,
      nome_cliente: parsed.data.nomeCliente,
      telefone: parsed.data.telefone ?? null,
      area_direito: parsed.data.areaDireito ?? null,
      resumo_fatos: parsed.data.resumoFatos,
      urgencia: parsed.data.urgencia,
    })
    .select("id")
    .single();

  if (error || !ficha) {
    return { error: "Não foi possível salvar a ficha. Tente novamente." };
  }

  revalidatePath("/app/fichas");
  revalidatePath("/app/dashboard");
  redirect(`/app/fichas/${ficha.id}`);
}

export type AcaoFichaResultado = { ok: true } | { ok: false; error: string };

export async function marcarFichaLidaAction(
  fichaId: string,
  lida: boolean,
): Promise<AcaoFichaResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  const { error } = await supabase.from("fichas_caso").update({ lida }).eq("id", fichaId);

  if (error) {
    return { ok: false, error: "Não foi possível atualizar a ficha. Tente novamente." };
  }

  revalidatePath("/app/fichas");
  revalidatePath(`/app/fichas/${fichaId}`);
  revalidatePath("/app/dashboard");
  return { ok: true };
}

const STATUS_PROCESSUAL_VALIDOS = ["em_andamento", "ganho", "acordo", "perdido", "arquivado"] as const;

/**
 * Atualiza o andamento/resultado do processo (`status_processual`, migration
 * 0011) — usado pela ficha de caso e consumido pela projeção de recebíveis
 * de êxito em `/app/financeiro/projecao-exito` (um caso "ganho"/"acordo"
 * confirma a expectativa de honorário de êxito mesmo antes de as parcelas
 * serem geradas; "perdido"/"arquivado" a zera).
 */
export async function atualizarStatusProcessualAction(
  fichaId: string,
  statusProcessual: string,
): Promise<AcaoFichaResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  if (!STATUS_PROCESSUAL_VALIDOS.includes(statusProcessual as (typeof STATUS_PROCESSUAL_VALIDOS)[number])) {
    return { ok: false, error: "Status processual inválido." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("fichas_caso")
    .update({ status_processual: statusProcessual, status_processual_atualizado_em: new Date().toISOString() })
    .eq("id", fichaId);

  if (error) {
    return { ok: false, error: "Não foi possível atualizar o status do caso. Tente novamente." };
  }

  revalidatePath("/app/fichas");
  revalidatePath(`/app/fichas/${fichaId}`);
  revalidatePath("/app/financeiro/projecao-exito");
  return { ok: true };
}

export async function excluirFichaAction(fichaId: string): Promise<AcaoFichaResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  const { error } = await supabase.from("fichas_caso").delete().eq("id", fichaId);

  if (error) {
    return { ok: false, error: "Não foi possível excluir a ficha. Tente novamente." };
  }

  revalidatePath("/app/fichas");
  redirect("/app/fichas");
}

const MARCADOR_RESUMO = "===RESUMO===";
const MARCADOR_QUESTOES = "===QUESTOES===";
const MARCADOR_ESTRATEGIA = "===ESTRATEGIA===";

function extrairSecao(texto: string, inicio: string, fim: string | null) {
  const posInicio = texto.indexOf(inicio);
  if (posInicio === -1) return null;
  const inicioConteudo = posInicio + inicio.length;
  const posFim = fim ? texto.indexOf(fim, inicioConteudo) : -1;
  const conteudo = posFim === -1 ? texto.slice(inicioConteudo) : texto.slice(inicioConteudo, posFim);
  return conteudo.trim() || null;
}

export type GerarAnaliseResultado = { ok: true } | { ok: false; error: string };

export async function gerarAnaliseIaAction(fichaId: string): Promise<GerarAnaliseResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  const mesRef = new Date().toISOString().slice(0, 7);

  const { count: usoAtual } = await supabase
    .from("uso_ia")
    .select("id", { count: "exact", head: true })
    .eq("mes_ref", mesRef);

  if ((usoAtual ?? 0) >= LIMITE_MENSAGENS_FREE) {
    return {
      ok: false,
      error: `Limite mensal de ${LIMITE_MENSAGENS_FREE} análises de IA do plano free atingido.`,
    };
  }

  const { data: ficha, error: erroFicha } = await supabase
    .from("fichas_caso")
    .select("*")
    .eq("id", fichaId)
    .single();

  if (erroFicha || !ficha) return { ok: false, error: "Ficha não encontrada." };

  const prompt = `Analise a triagem de cliente abaixo e produza uma análise jurídica estruturada para o advogado responsável.

DADOS DO CLIENTE:
- Nome: ${ficha.nome_cliente ?? "não informado"}
- Área relatada: ${ficha.area_direito ?? "não informada"}
- Fatos: ${ficha.resumo_fatos ?? "não informados"}
- Urgência relatada: ${ficha.urgencia}

Responda EXATAMENTE no formato abaixo, substituindo o conteúdo entre colchetes e mantendo as marcações de seção intactas (sem markdown adicional nas linhas de marcação):

${MARCADOR_RESUMO}
[Resumo objetivo do caso em 3 a 6 linhas]

${MARCADOR_QUESTOES}
[Lista das principais questões jurídicas envolvidas, uma por linha iniciada com "- "]

${MARCADOR_ESTRATEGIA}
[Estratégias possíveis e a recomendação do advogado sênior, incluindo documentos a solicitar e próximos passos]`;

  let respostaIa;
  try {
    respostaIa = await gerarResposta([{ role: "user", conteudo: prompt }]);
  } catch (erro) {
    console.error("[fichas/gerarAnaliseIaAction] Falha ao gerar análise da IA:", erro);
    return { ok: false, error: "A IA está indisponível no momento. Tente novamente em instantes." };
  }

  const resumoIa = extrairSecao(respostaIa.texto, MARCADOR_RESUMO, MARCADOR_QUESTOES) ?? respostaIa.texto;
  const questoesIa = extrairSecao(respostaIa.texto, MARCADOR_QUESTOES, MARCADOR_ESTRATEGIA);
  const estrategiaIa = extrairSecao(respostaIa.texto, MARCADOR_ESTRATEGIA, null);

  const { error: erroUpdate } = await supabase
    .from("fichas_caso")
    .update({ resumo_ia: resumoIa, questoes_ia: questoesIa, estrategia_ia: estrategiaIa })
    .eq("id", fichaId);

  if (erroUpdate) return { ok: false, error: "A IA respondeu, mas houve um erro ao salvar a análise." };

  await supabase.from("uso_ia").insert({
    escritorio_id: usuario.perfil.escritorio_id,
    tokens_in: respostaIa.tokensIn,
    tokens_out: respostaIa.tokensOut,
    mes_ref: mesRef,
  });

  revalidatePath(`/app/fichas/${fichaId}`);
  revalidatePath("/app/financeiro");

  return { ok: true };
}

export type GerarRiscoResultado = { ok: true } | { ok: false; error: string };

/**
 * Calcula (ou recalcula) o `nivel_risco` da ficha via IA. Diferente da
 * análise geral (`gerarAnaliseIaAction`), não consome a cota de
 * `uso_ia`/`LIMITE_MENSAGENS_FREE` — é uma classificação curta e barata
 * (schema fechado, poucos tokens de saída), não uma peça de análise
 * completa; manter fora do limite evita que um escritório no plano free
 * fique sem cota de análise por causa de recálculos de risco.
 */
export async function gerarRiscoAction(fichaId: string): Promise<GerarRiscoResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  const { data: ficha, error: erroFicha } = await supabase
    .from("fichas_caso")
    .select("resumo_fatos, questoes_ia, estrategia_ia, area_direito, urgencia")
    .eq("id", fichaId)
    .single();

  if (erroFicha || !ficha) return { ok: false, error: "Ficha não encontrada." };

  const classificacao = await classificarRiscoFicha(ficha);
  if (!classificacao) {
    return { ok: false, error: "A IA está indisponível no momento. Tente novamente em instantes." };
  }

  const { error: erroUpdate } = await supabase
    .from("fichas_caso")
    .update({ nivel_risco: classificacao.nivelRisco, risco_calculado_em: new Date().toISOString() })
    .eq("id", fichaId);

  if (erroUpdate) return { ok: false, error: "A IA respondeu, mas houve um erro ao salvar o risco." };

  revalidatePath(`/app/fichas/${fichaId}`);
  revalidatePath("/app/fichas");

  return { ok: true };
}

export type GerarPeticaoResultado =
  | { ok: true; textoFinal: string; variaveisNaoResolvidas: string[] }
  | { ok: false; error: string };

/**
 * Petição por modelo com variáveis (mail-merge jurídico, migration 0010): a
 * partir da ficha aberta na tela, resolve `{{nome_cliente}}`,
 * `{{numero_processo}}`, `{{area_direito}}`, `{{valor_causa}}` e
 * `{{data_hoje}}` contra os dados reais do caso (ficha + prazo mais recente
 * com número de processo + contrato de honorário mais recente) e roda o
 * mail-merge puro (`resolverMailMerge`). Grava sempre uma linha em
 * `peticoes_geradas` com o snapshot de `variaveis_usadas` (auditoria
 * jurídica: "o que foi gerado, a partir de qual modelo, para qual caso, por
 * quem"), mesmo quando alguma variável não foi resolvida — a petição ainda é
 * retornada ao usuário com o aviso, nunca bloqueada silenciosamente.
 */
export async function gerarPeticaoDeModeloAction(
  fichaId: string,
  modeloId: string,
): Promise<GerarPeticaoResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  const resultado = await gerarDocumentoDaFicha(supabase, {
    fichaId,
    modeloId,
    escritorioId: usuario.perfil.escritorio_id,
    perfilId: usuario.perfil.id,
  });

  if (!resultado.ok) return resultado;

  return {
    ok: true,
    textoFinal: resultado.resultado.textoFinal,
    variaveisNaoResolvidas: resultado.resultado.variaveisNaoResolvidas,
  };
}
