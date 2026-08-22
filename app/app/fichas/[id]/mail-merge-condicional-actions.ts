"use server";

import { revalidatePath } from "next/cache";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { planoTemAcesso } from "@/lib/planos/gating";
import {
  MotorTemplateCondicionalError,
  modeloUsaLogicaCondicional,
  resolverMailMergeCondicional,
  type ResultadoMailMergeCondicional,
} from "@/lib/mailmerge-condicional/motor";
import {
  montarDadosCondicionaisDaFicha,
  type ContratoParaTemplate,
  type ParcelaParaTemplate,
  type PrazoParaTemplate,
} from "@/lib/mailmerge-condicional/montar-dados";
import {
  montarContextoCaso,
  type EstrategiaProntaParaContexto,
  type EventoCasoParaContexto,
  type PessoaCasoParaContexto,
  type TarefaCasoParaContexto,
  type TeseCasoParaContexto,
} from "@/lib/mailmerge-condicional/contexto-caso";

export type ModeloCondicional = { id: string; nome: string; conteudo: string };

export type GerarDocumentoCondicionalResultado =
  | { ok: true; modelo: ModeloCondicional; resultado: ResultadoMailMergeCondicional }
  | { ok: false; error: string };

type ModeloRow = { id: string; nome: string; conteudo: string };
type FichaRow = { id: string; nome_cliente: string | null; area_direito: string | null; cliente_id: string | null };
type ContratoRow = { id: string } & ContratoParaTemplate;

/**
 * Falha ao carregar uma fonte do Caso Inteligente (pessoas/eventos/teses/
 * tarefas/estratégia) NÃO pode quebrar a geração do documento: o contexto
 * base (ficha/prazos/contratos/parcelas) já veio completo e as variáveis do
 * caso são um enriquecimento — se faltarem, viram "não informado"/coleção
 * vazia no motor, que é exatamente o comportamento de dado ausente previsto
 * para templates. Logamos para diagnóstico e seguimos com o que temos
 * (resiliência > rigidez).
 */
function logarFalhaContextoCaso(fonte: string, erro: { message: string } | null): void {
  console.error(
    `[fichas/mail-merge-condicional-actions] Falha ao carregar "${fonte}" do Caso Inteligente — seguindo sem essa parte do contexto:`,
    erro?.message ?? erro,
  );
}

/**
 * Lista, para a ficha, só os modelos cujo `conteudo` de fato usa a sintaxe
 * condicional (`{{#se}}`/`{{#cada}}`) — modelos puramente literais continuam
 * sendo servidos pelo card de mail-merge simples (`GerarPeticaoCard`), que
 * já cobre esse caso sem gate de plano. Não precisa de coluna nova em
 * `modelos`: a detecção é feita em cima do próprio texto salvo, então nunca
 * fica desatualizada em relação ao que o usuário editou por último.
 */
export async function listarModelosCondicionaisAction(): Promise<ModeloCondicional[]> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("modelos")
    .select("id, nome, conteudo")
    .order("nome", { ascending: true })
    .returns<ModeloRow[]>();

  return (data ?? []).filter((modelo) => modeloUsaLogicaCondicional(modelo.conteudo));
}

/**
 * Automação de documento com lógica condicional (feature Pro
 * "automacao_documento_condicional", migration 0020) — evolução do
 * mail-merge literal de `gerarPeticaoDeModeloAction`
 * (`app/app/fichas/actions.ts`, plano free): o modelo pode ter blocos
 * `{{#se ...}}`/`{{#cada ...}}` resolvidos deterministicamente pelo motor
 * puro (`lib/mailmerge-condicional/motor.ts`), sem a IA decidir o resultado
 * de um "if" — só o dado é que decide.
 *
 * Diferente do mail-merge simples: busca TODOS os prazos, TODOS os
 * contratos e TODAS as parcelas vinculados à ficha (não só o mais recente
 * de cada), porque `{{#cada parcelas}}` precisa da coleção inteira para
 * iterar (ex: listar cada parcela em atraso).
 *
 * Fase 9 (auto-fill do Caso Inteligente): além disso carrega pessoas,
 * eventos, teses, tarefas e a estratégia mais recente pronta da ficha
 * (`lib/mailmerge-condicional/contexto-caso.ts`) e mescla no contexto antes
 * do resolver — falhas nessas queries extras não quebram a geração.
 *
 * Gate de plano é a PRIMEIRA coisa checada, antes de qualquer busca de
 * dados — nunca gastar round-trips de banco para depois descobrir que o
 * escritório não tem acesso.
 */
export async function gerarDocumentoCondicionalAction(
  fichaId: string,
  modeloId: string,
): Promise<GerarDocumentoCondicionalResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  if (!planoTemAcesso(usuario.perfil.escritorio, "automacao_documento_condicional")) {
    return { ok: false, error: "Automação de documento com lógica condicional é um recurso do plano Pro." };
  }

  if (!modeloId) {
    return { ok: false, error: "Selecione um modelo para gerar o documento." };
  }

  const supabase = await createClient();

  const { data: modeloData, error: erroModelo } = await supabase
    .from("modelos")
    .select("id, nome, conteudo")
    .eq("id", modeloId)
    .maybeSingle();

  if (erroModelo || !modeloData) return { ok: false, error: "Modelo não encontrado." };
  const modelo = modeloData as ModeloRow;

  const { data: fichaData, error: erroFicha } = await supabase
    .from("fichas_caso")
    .select("id, nome_cliente, area_direito, cliente_id")
    .eq("id", fichaId)
    .maybeSingle();

  if (erroFicha || !fichaData) return { ok: false, error: "Ficha não encontrada." };
  const ficha = fichaData as FichaRow;

  let nomeClientePorRelacao: string | null = null;
  if (!ficha.nome_cliente && ficha.cliente_id) {
    const { data: cliente } = await supabase
      .from("clientes")
      .select("nome")
      .eq("id", ficha.cliente_id)
      .maybeSingle<{ nome: string | null }>();
    nomeClientePorRelacao = cliente?.nome ?? null;
  }

  const [{ data: prazosData }, { data: contratosData }] = await Promise.all([
    supabase
      .from("prazos")
      .select("titulo, descricao, data_prazo, processo, concluido")
      .eq("ficha_caso_id", fichaId)
      .order("data_prazo", { ascending: true })
      .returns<PrazoParaTemplate[]>(),
    supabase
      .from("contratos_honorario")
      .select("id, tipo, valor_total, percentual_exito")
      .eq("ficha_caso_id", fichaId)
      .order("criado_em", { ascending: false })
      .returns<ContratoRow[]>(),
  ]);

  const contratos = contratosData ?? [];
  const contratoIds = contratos.map((contrato) => contrato.id);

  let parcelas: ParcelaParaTemplate[] = [];
  if (contratoIds.length > 0) {
    const { data: parcelasData } = await supabase
      .from("parcelas_honorario")
      .select("numero_parcela, valor, vencimento, status")
      .in("contrato_id", contratoIds)
      .order("vencimento", { ascending: true })
      .returns<ParcelaParaTemplate[]>();
    parcelas = parcelasData ?? [];
  }

  const dados = montarDadosCondicionaisDaFicha({
    nomeClienteFicha: ficha.nome_cliente,
    nomeClientePorRelacao,
    areaDireito: ficha.area_direito,
    prazos: prazosData ?? [],
    contratos,
    parcelas,
  });

  // ── Fase 9: contexto do Caso Inteligente (auto-fill) ───────────────────
  // Enriquece o contexto com pessoas/eventos/teses/tarefas + estratégia mais
  // recente PRONTA da ficha. Cada query é tolerante a falha individual (ver
  // `logarFalhaContextoCaso`): erro em uma fonte não derruba as demais nem a
  // geração — pior caso, o modelo resolve aquelas variáveis como "não
  // informado", mesmo contrato de dado ausente do resto do sistema.
  // RLS por escritorio_id já restringe cada tabela; o filtro por
  // `ficha_caso_id` segue o mesmo padrão das queries de prazos acima.
  const [
    { data: pessoasData, error: erroPessoas },
    { data: eventosData, error: erroEventos },
    { data: tesesData, error: erroTeses },
    { data: tarefasData, error: erroTarefas },
    { data: estrategiasData, error: erroEstrategias },
  ] = await Promise.all([
    supabase
      .from("pessoas_caso")
      .select("nome, tipo, documento, contato, papel_processual")
      .eq("ficha_caso_id", fichaId)
      // Ordem de cadastro = ordem estável para {{#cada pessoas}}.
      .order("criado_em", { ascending: true })
      .returns<PessoaCasoParaContexto[]>(),
    supabase
      .from("eventos_caso")
      .select("tipo_evento, descricao, data_evento, origem")
      .eq("ficha_caso_id", fichaId)
      // A ordenação final por data é refeita no módulo puro; aqui já alinha
      // com o índice composto (ficha_caso_id, data_evento) da migration 0024.
      .order("data_evento", { ascending: true })
      .returns<EventoCasoParaContexto[]>(),
    supabase
      .from("teses_caso")
      .select("id, tese, fundamentacao, status")
      .eq("ficha_caso_id", fichaId)
      // Mais recentemente tocadas primeiro (mesmo critério de priorização do
      // Estrategista, ADR 0014 seção 4).
      .order("atualizado_em", { ascending: false })
      .returns<TeseCasoParaContexto[]>(),
    supabase
      .from("tarefas_caso")
      .select("titulo, status, prioridade, prazo_opcional")
      .eq("ficha_caso_id", fichaId)
      // A ordenação "pendentes primeiro / prioridade / prazo" é regra de
      // apresentação do template → vive no módulo puro (contexto-caso.ts).
      .order("criado_em", { ascending: true })
      .returns<TarefaCasoParaContexto[]>(),
    supabase
      .from("estrategias_caso")
      // Apenas a MAIS RECENTE concluída ('pronto') — 'processando'/'erro' não
      // têm resultado utilizável (coluna jsonb null), e nunca bloquear a
      // geração esperando processamento em andamento.
      .select("resultado_estrategia")
      .eq("ficha_caso_id", fichaId)
      .eq("status", "pronto")
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle<EstrategiaProntaParaContexto>(),
  ]);

  if (erroPessoas) logarFalhaContextoCaso("pessoas_caso", erroPessoas);
  if (erroEventos) logarFalhaContextoCaso("eventos_caso", erroEventos);
  if (erroTeses) logarFalhaContextoCaso("teses_caso", erroTeses);
  if (erroTarefas) logarFalhaContextoCaso("tarefas_caso", erroTarefas);
  if (erroEstrategias) logarFalhaContextoCaso("estrategias_caso", erroEstrategias);

  const contextoCaso = montarContextoCaso({
    pessoas: pessoasData ?? [],
    eventos: eventosData ?? [],
    teses: tesesData ?? [],
    tarefas: tarefasData ?? [],
    estrategia: estrategiasData ?? null,
  });

  let resultado: ResultadoMailMergeCondicional;
  try {
    // Merge por espalhamento: chaves novas do caso NUNCA sobrescrevem as pré-
    // existentes (nome_cliente etc.) — os prefixos distintos (total_/estrategia_/
    // coleções próprias) tornam colisão impossível hoje, e o spread mantém o
    // contexto base vencedor se isso mudar no futuro.
    resultado = resolverMailMergeCondicional(modelo.conteudo, { ...dados, ...contextoCaso });
  } catch (erro) {
    if (erro instanceof MotorTemplateCondicionalError) {
      return { ok: false, error: `Erro na sintaxe do modelo: ${erro.message}` };
    }
    console.error("[fichas/mail-merge-condicional-actions] Falha inesperada ao resolver template:", erro, {
      fichaId,
      modeloId,
    });
    return { ok: false, error: "Não foi possível processar o modelo. Tente novamente." };
  }

  const { error: erroInsercao } = await supabase.from("documentos_condicionais_gerados").insert({
    escritorio_id: usuario.perfil.escritorio_id,
    modelo_id: modelo.id,
    ficha_caso_id: fichaId,
    gerado_por: usuario.perfil.id,
    variaveis_usadas: resultado.variaveisUsadas,
    variaveis_nao_resolvidas: resultado.variaveisNaoResolvidas,
  });

  if (erroInsercao) {
    console.error("[fichas/mail-merge-condicional-actions] Falha ao registrar auditoria:", erroInsercao, {
      fichaId,
      modeloId,
    });
    return {
      ok: false,
      error: "O documento foi gerado, mas houve um erro ao registrar a auditoria. Tente novamente.",
    };
  }

  revalidatePath(`/app/fichas/${fichaId}`);

  return {
    ok: true,
    modelo: { id: modelo.id, nome: modelo.nome, conteudo: modelo.conteudo },
    resultado,
  };
}
