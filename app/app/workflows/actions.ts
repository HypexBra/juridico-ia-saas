"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { planoTemAcesso } from "@/lib/planos/gating";
import {
  MotorTemplateCondicionalError,
  resolverMailMergeCondicional,
} from "@/lib/mailmerge-condicional/motor";
import {
  montarDadosCondicionaisDaFicha,
  type ContratoParaTemplate,
  type ParcelaParaTemplate,
  type PrazoParaTemplate,
} from "@/lib/mailmerge-condicional/montar-dados";
import { notificarClientePortal } from "@/lib/notificacoes/notificar-cliente";
import { TIPOS_ACAO_WORKFLOW, type ConfiguracaoAcao, type TipoAcaoWorkflow } from "@/lib/workflows/tipos";
import {
  avancarExecucao,
  normalizarConfiguracaoAcao,
  validarDefinicaoWorkflow,
  type EtapaParaAvanco,
  type StatusEtapaExecucao,
} from "@/lib/workflows/motor";

/**
 * FASE 8 — Workflow Engine (ADR docs/adrs/0016-workflow-engine.md).
 *
 * Camada de I/O das features de workflow: TODAS as decisões de negócio
 * (validação de definição, máquina de estados da cadeia) vivem no motor puro
 * (`lib/workflows/motor.ts`) — este arquivo só orquestra Supabase e traduz
 * resultados para o contrato `{ ok, ... } | { ok: false, error }`.
 *
 * Regras de execução implementadas aqui em cima do motor:
 *   - Cadeia automática roda SÍNCRONA dentro da action (as ações são rápidas
 *     inserts locais + mail-merge determinístico; nenhuma chamada de IA na
 *     cadeia) e PARA na primeira etapa que falha.
 *   - `aprovar_humano` nunca executa sozinha: pausa em `aguardando_humano`
 *     até `concluirEtapaHumanaAction` retomar.
 *   - Erro NÃO cancela a execução: ela segue `em_andamento` para permitir
 *     retry apenas da etapa falhada (`reprocessarEtapaAction`).
 */

const FEATURE_WORKFLOWS = "workflows_automacao" as const;

// ── Schemas Zod (shape grosseiro; semântica fina fica no motor puro) ────

const configuracaoSchema = z.record(z.string(), z.unknown());

const etapaInputSchema = z.object({
  ordem: z.number().int().min(1),
  tipo_acao: z.enum(TIPOS_ACAO_WORKFLOW),
  titulo: z.string().trim().min(1).max(200),
  configuracao: configuracaoSchema,
});

const salvarWorkflowSchema = z.object({
  id: z.string().uuid().nullish(),
  nome: z.string().trim().min(1, "Informe o nome do workflow.").max(120),
  descricao: z.string().trim().max(2000).nullish(),
  etapas: z.array(etapaInputSchema).min(1, "O workflow precisa de pelo menos uma etapa.").max(30),
});

const idSchema = z.object({ id: z.string().uuid() });

const iniciarExecucaoSchema = z.object({
  workflowId: z.string().uuid(),
  fichaCasoId: z.string().uuid(),
});

/**
 * Contrato padrão do projeto (`{ ok, ... } | { ok: false, error }`) —
 * variantes explícitas por action, sem genérico, igual às demais actions.
 */
export type ResultadoSimples = { ok: true } | { ok: false; error: string };
export type ResultadoComWorkflowId = { ok: true; id: string } | { ok: false; error: string };
export type ResultadoComExecucao = { ok: true; execucaoId: string } | { ok: false; error: string };

/** Gate padrão do projeto: auth PRIMEIRO, plano logo depois — antes de qualquer I/O caro. */
async function autorizar(): Promise<
  { usuario: Exclude<Awaited<ReturnType<typeof getUsuarioAtual>>, null> } | { erro: string }
> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { erro: "Sessão expirada. Faça login novamente." };
  if (!planoTemAcesso(usuario.perfil.escritorio, FEATURE_WORKFLOWS)) {
    return { erro: "Automação de workflows está disponível apenas no plano Pro." };
  }
  return { usuario };
}

// ── CRUD de definição ───────────────────────────────────────────────────

/**
 * Cria ou atualiza um workflow. A edição substitui o conjunto de etapas
 * (delete + insert) porque ordens/tipos/configurações podem mudar por
 * completo entre versões — não há diff que valha o custo aqui.
 *
 * Limitação consciente (mesmo nível do restante do projeto): o client
 * Supabase SSR não expõe transação multi-statement, então delete+insert não
 * são atômicos. Se o insert das novas etapas falhar, o workflow fica salvo
 * SEM etapas — estado visível na UI (lista mostra "sem etapas"), recuperável
 * reeditando; nunca corrompemos dados de OUTRA tabela.
 */
export async function salvarWorkflowAction(input: unknown): Promise<ResultadoComWorkflowId> {
  const auth = await autorizar();
  if ("erro" in auth) return { ok: false, error: auth.erro };

  const parsed = salvarWorkflowSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const dados = parsed.data;

  // Validação SEMÂNTICA (config por tipo, ordens duplicadas, títulos) no motor puro.
  const validacao = validarDefinicaoWorkflow(dados.etapas);
  if (!validacao.ok) return { ok: false, error: validacao.erros.join(" ") };

  // Normaliza configurações para o tipo fechado (descarta campos extras do client).
  const etapasNormalizadas = dados.etapas.flatMap((etapaAtual) => {
    const config = normalizarConfiguracaoAcao(etapaAtual.tipo_acao, etapaAtual.configuracao);
    if (!config) return [];
    return [
      {
        ordem: etapaAtual.ordem,
        tipo_acao: etapaAtual.tipo_acao,
        titulo: etapaAtual.titulo.trim(),
        configuracao: config as unknown as Record<string, unknown>,
      },
    ];
  });
  if (etapasNormalizadas.length !== dados.etapas.length) {
    return { ok: false, error: "Há etapas com configuração inválida. Revise os campos destacados." };
  }

  try {
    const supabase = await createClient();
    let workflowId = dados.id ?? null;

    if (workflowId) {
      const { data: existente } = await supabase
        .from("workflows")
        .select("id")
        .eq("id", workflowId)
        .maybeSingle<{ id: string }>();
      if (!existente) return { ok: false, error: "Workflow não encontrado." };

      const { error: erroUpdate } = await supabase
        .from("workflows")
        .update({ nome: dados.nome, descricao: dados.descricao ?? null, atualizado_em: new Date().toISOString() })
        .eq("id", workflowId);
      if (erroUpdate) throw erroUpdate;

      const { error:ErroDeleteEtapas } = await supabase.from("workflow_etapas").delete().eq("workflow_id", workflowId);
      if (ErroDeleteEtapas) throw ErroDeleteEtapas;
    } else {
      const { data: criado, error: erroInsert } = await supabase
        .from("workflows")
        .insert({
          escritorio_id: auth.usuario.perfil.escritorio_id,
          nome: dados.nome,
          descricao: dados.descricao ?? null,
          criado_por: auth.usuario.perfil.id,
        })
        .select("id")
        .single<{ id: string }>();
      if (erroInsert || !criado) throw erroInsert ?? new Error("Insert de workflow não retornou linha.");
      workflowId = criado.id;
    }

    const { error: erroEtapas } = await supabase.from("workflow_etapas").insert(
      etapasNormalizadas.map((etapaAtual) => ({
        escritorio_id: auth.usuario.perfil.escritorio_id,
        workflow_id: workflowId,
        ordem: etapaAtual.ordem,
        // tipo_acao já veio do z.enum — union fechada, sem cast necessário.
        tipo_acao: etapaAtual.tipo_acao,
        titulo: etapaAtual.titulo,
        configuracao: etapaAtual.configuracao,
      })),
    );
    if (erroEtapas) throw erroEtapas;

    revalidatePath("/app/workflows");
    return { ok: true, id: workflowId };
  } catch (erro) {
    console.error("[workflows/salvar] Falha:", erro, { nome: dados.nome, editando: Boolean(dados.id) });
    return { ok: false, error: "Não foi possível salvar o workflow. Tente novamente." };
  }
}

export async function alternarWorkflowAtivoAction(id: string, ativo: boolean): Promise<ResultadoSimples> {
  const auth = await autorizar();
  if ("erro" in auth) return { ok: false, error: auth.erro };

  const parsed = idSchema.safeParse({ id });
  if (!parsed.success || typeof ativo !== "boolean") return { ok: false, error: "Dados inválidos." };

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("workflows")
      .update({ ativo, atualizado_em: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;

    revalidatePath("/app/workflows");
    return { ok: true };
  } catch (erro) {
    console.error("[workflows/alternar-ativo] Falha:", erro, { id });
    return { ok: false, error: "Não foi possível atualizar o workflow. Tente novamente." };
  }
}

export async function excluirWorkflowAction(id: string): Promise<ResultadoSimples> {
  const auth = await autorizar();
  if ("erro" in auth) return { ok: false, error: auth.erro };

  const parsed = idSchema.safeParse({ id });
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };

  try {
    const supabase = await createClient();
    // ON DELETE CASCADE apaga as etapas; execuções passam a referenciar NULL
    // (migration 0044) preservando o histórico via snapshot `workflow_nome`.
    const { error } = await supabase.from("workflows").delete().eq("id", id);
    if (error) throw error;

    revalidatePath("/app/workflows");
    return { ok: true };
  } catch (erro) {
    console.error("[workflows/excluir] Falha:", erro, { id });
    return { ok: false, error: "Não foi possível excluir o workflow. Tente novamente." };
  }
}

// ── Execução ────────────────────────────────────────────────────────────

type EtapaInstanciadaRow = {
  id: string;
  execucao_id: string;
  ordem: number;
  tipo_acao: string;
  titulo: string;
  configuracao: Record<string, unknown>;
  status: StatusEtapaExecucao;
};

/**
 * Inicia uma execução do workflow sobre uma ficha de caso: cria o registro de
 * execução, INSTANCIA as etapas (snapshot imutável da definição no momento do
 * disparo) e roda a cadeia automática síncrona.
 */
export async function iniciarExecucaoAction(
  workflowId: string,
  fichaCasoId: string,
): Promise<ResultadoComExecucao> {
  const auth = await autorizar();
  if ("erro" in auth) return { ok: false, error: auth.erro };

  const parsed = iniciarExecucaoSchema.safeParse({ workflowId, fichaCasoId });
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };

  try {
    const supabase = await createClient();

    // Workflow tem que ser ATIVO e deste tenant (RLS filtra escritório).
    const { data: workflow } = await supabase
      .from("workflows")
      .select("id, nome, ativo")
      .eq("id", workflowId)
      .maybeSingle<{ id: string; nome: string; ativo: boolean }>();
    if (!workflow || !workflow.ativo) return { ok: false, error: "Workflow não encontrado ou inativo." };

    // Ficha também do tenant (RLS); soft-deleted não disparam workflow.
    const { data: ficha } = await supabase
      .from("fichas_caso")
      .select("id")
      .eq("id", fichaCasoId)
      .is("deletado_em", null)
      .maybeSingle<{ id: string }>();
    if (!ficha) return { ok: false, error: "Caso não encontrado." };

    const { data: definicoes } = await supabase
      .from("workflow_etapas")
      .select("id, ordem, tipo_acao, titulo, configuracao")
      .eq("workflow_id", workflowId)
      .order("ordem", { ascending: true })
      .returns<Array<{ id: string; ordem: number; tipo_acao: string; titulo: string; configuracao: Record<string, unknown> }>>();

    const definicoesOrdenadas = [...(definicoes ?? [])].sort((a, b) => a.ordem - b.ordem);
    if (definicoesOrdenadas.length === 0) {
      return { ok: false, error: "Este workflow não tem etapas definidas. Edite-o antes de executar." };
    }

    const { data: execucao, error: erroExecucao } = await supabase
      .from("workflow_execucoes")
      .insert({
        escritorio_id: auth.usuario.perfil.escritorio_id,
        workflow_id: workflow.id,
        workflow_nome: workflow.nome,
        ficha_caso_id: fichaCasoId,
        iniciada_por: auth.usuario.perfil.id,
      })
      .select("id")
      .single<{ id: string }>();
    if (erroExecucao || !execucao) throw erroExecucao ?? new Error("Insert de execução não retornou linha.");

    // Instanciação = cópia fiel da definição (título/tipo/config congelados).
    const { data: etapasCriadas, error: erroEtapas } = await supabase
      .from("workflow_execucao_etapas")
      .insert(
        definicoesOrdenadas.map((definicao) => ({
          escritorio_id: auth.usuario.perfil.escritorio_id,
          execucao_id: execucao.id,
          etapa_origem_id: definicao.id,
          ordem: definicao.ordem,
          tipo_acao: definicao.tipo_acao,
          titulo: definicao.titulo,
          configuracao: definicao.configuracao,
        })),
      )
      .select("id, execucao_id, ordem, tipo_acao, titulo, configuracao, status")
      .returns<EtapaInstanciadaRow[]>();
    if (erroEtapas || !etapasCriadas) throw erroEtapas ?? new Error("Instanciação de etapas não retornou linhas.");

    await executarCadeiaAutomatica(supabase, execucao.id, {
      escritorioId: auth.usuario.perfil.escritorio_id,
      perfilId: auth.usuario.perfil.id,
    });

    revalidatePath("/app/workflows");
    return { ok: true, execucaoId: execucao.id };
  } catch (erro) {
    console.error("[workflows/iniciar-execucao] Falha:", erro, { workflowId, fichaCasoId });
    return { ok: false, error: "Não foi possível iniciar a execução. Tente novamente." };
  }
}

/**
 * Human-in-the-loop: marca a etapa de aprovação como concluída e retoma a
 * cadeia automática a partir dali (mesma função interna usada no disparo).
 */
export async function concluirEtapaHumanaAction(execucaoEtapaId: string): Promise<ResultadoSimples> {
  const auth = await autorizar();
  if ("erro" in auth) return { ok: false, error: auth.erro };

  const parsed = idSchema.safeParse({ id: execucaoEtapaId });
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };

  try {
    const supabase = await createClient();

    const { data: etapa } = await supabase
      .from("workflow_execucao_etapas")
      .select("id, status, tipo_acao, execucao_id")
      .eq("id", execucaoEtapaId)
      .maybeSingle<Pick<EtapaInstanciadaRow, "id" | "status" | "tipo_acao" | "execucao_id">>();
    if (!etapa) return { ok: false, error: "Etapa não encontrada." };
    if (etapa.status !== "aguardando_humano") {
      return { ok: false, error: "Esta etapa não está aguardando aprovação humana." };
    }

    const { error: erroUpdate } = await supabase
      .from("workflow_execucao_etapas")
      .update({ status: "concluida", resultado: {}, executada_em: new Date().toISOString() })
      .eq("id", execucaoEtapaId);
    if (erroUpdate) throw erroUpdate;

    await executarCadeiaAutomatica(supabase, etapa.execucao_id, {
      escritorioId: auth.usuario.perfil.escritorio_id,
      perfilId: auth.usuario.perfil.id,
    });

    revalidatePath("/app/workflows");
    return { ok: true };
  } catch (erro) {
    console.error("[workflows/concluir-etapa-humana] Falha:", erro, { execucaoEtapaId });
    return { ok: false, error: "Não foi possível concluir a etapa. Tente novamente." };
  }
}

/**
 * Retry de etapa falhada: volta-a para `pendente` (mantendo a trilha anterior
 * em `resultado.historico`) e refaz a cadeia — a etapa é reexecutada junto
 * com as seguintes que estavam paradas.
 */
export async function reprocessarEtapaAction(execucaoEtapaId: string): Promise<ResultadoSimples> {
  const auth = await autorizar();
  if ("erro" in auth) return { ok: false, error: auth.erro };

  const parsed = idSchema.safeParse({ id: execucaoEtapaId });
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };

  try {
    const supabase = await createClient();

    const { data: etapa } = await supabase
      .from("workflow_execucao_etapas")
      .select("id, status, resultado, execucao_id")
      .eq("id", execucaoEtapaId)
      .maybeSingle<Pick<EtapaInstanciadaRow, "id" | "status"> & { resultado: unknown; execucao_id: string }>();
    if (!etapa) return { ok: false, error: "Etapa não encontrada." };
    if (etapa.status !== "falha") {
      return { ok: false, error: "Só é possível reprocessar etapas que falharam." };
    }

    const { error: erroReset } = await supabase
      .from("workflow_execucao_etapas")
      .update({
        status: "pendente",
        resultado: { historico_falha: etapa.resultado ?? null },
      })
      .eq("id", execucaoEtapaId);
    if (erroReset) throw erroReset;

    await executarCadeiaAutomatica(supabase, etapa.execucao_id, {
      escritorioId: auth.usuario.perfil.escritorio_id,
      perfilId: auth.usuario.perfil.id,
    });

    revalidatePath("/app/workflows");
    return { ok: true };
  } catch (erro) {
    console.error("[workflows/reprocessar-etapa] Falha:", erro, { execucaoEtapaId });
    return { ok: false, error: "Não foi possível reprocessar a etapa. Tente novamente." };
  }
}

/** Cancela a execução inteira + etapas pendentes/aguardando (terminal). */
export async function cancelarExecucaoAction(execucaoId: string): Promise<ResultadoSimples> {
  const auth = await autorizar();
  if ("erro" in auth) return { ok: false, error: auth.erro };

  const parsed = idSchema.safeParse({ id: execucaoId });
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };

  try {
    const supabase = await createClient();

    const { error: erroExecucao } = await supabase
      .from("workflow_execucoes")
      .update({ status: "cancelada" })
      .eq("id", execucaoId)
      .eq("status", "em_andamento");
    if (erroExecucao) throw erroExecucao;

    const { error: erroEtapas } = await supabase
      .from("workflow_execucao_etapas")
      .update({ status: "cancelada" })
      .eq("execucao_id", execucaoId)
      .in("status", ["pendente", "aguardando_humano"]);
    if (erroEtapas) throw erroEtapas;

    revalidatePath("/app/workflows");
    return { ok: true };
  } catch (erro) {
    console.error("[workflows/cancelar-execucao] Falha:", erro, { execucaoId });
    return { ok: false, error: "Não foi possível cancelar a execução. Tente novamente." };
  }
}

// ── Cadeia automática (função interna compartilhada) ────────────────────

/** Erro "de domínio": mensagem pronta para exibir ao usuário no jsonb resultado. */
class ErroEtapa extends Error {}

/** Contexto resolvido UMA vez por passagem da cadeia e repassado aos executores. */
type ContextoExecucaoEtapa = {
  escritorioId: string;
  perfilId: string;
  /** Ficha alvo lida da própria execução — nunca de input do client. */
  fichaCasoId: string;
};

/**
 * Roda tudo que pode rodar sozinho a partir do estado ATUAL das etapas no
 * banco (fonte de verdade): sequência automática → pausa humana → conclusão.
 * Idempotente por construção: chamar quando nada há a fazer é um no-op.
 * Chamada pelas três portas de retomada: disparo inicial, aprovação humana
 * e retry de etapa falhada.
 */
async function executarCadeiaAutomatica(
  supabase: Awaited<ReturnType<typeof createClient>>,
  execucaoId: string,
  contextoBase: { escritorioId: string; perfilId: string },
): Promise<void> {
  const { data: execucao } = await supabase
    .from("workflow_execucoes")
    .select("ficha_caso_id, status")
    .eq("id", execucaoId)
    .maybeSingle<{ ficha_caso_id: string; status: string }>();
  if (!execucao || execucao.status !== "em_andamento") return;

  const contexto: ContextoExecucaoEtapa = {
    escritorioId: contextoBase.escritorioId,
    perfilId: contextoBase.perfilId,
    fichaCasoId: execucao.ficha_caso_id,
  };

  const { data: etapasBanco } = await supabase
    .from("workflow_execucao_etapas")
    .select("id, ordem, tipo_acao, titulo, configuracao, status")
    .eq("execucao_id", execucaoId)
    .returns<EtapaInstanciadaRow[]>();

  const etapas = etapasBanco ?? [];
  if (etapas.length === 0) return;

  const ordenadas = [...etapas].sort((a, b) => a.ordem - b.ordem);
  const definicaoParaMotor: EtapaParaAvanco[] = ordenadas.map((etapaAtual) => ({
    ordem: etapaAtual.ordem,
    tipo_acao: etapaAtual.tipo_acao as TipoAcaoWorkflow,
  }));

  // Estados em memória durante esta passagem — a action é single-writer da
  // cadeia síncrona, então não há concorrência dentro desta função.
  const estados: Record<number, StatusEtapaExecucao> = Object.fromEntries(
    ordenadas.map((etapaAtual) => [etapaAtual.ordem, etapaAtual.status]),
  );

  // Guarda de loop: cada iteração consome ao menos uma etapa automática;
  // nº etapas + folga cobre qualquer caminho legítimo.
  const maxIteracoes = ordenadas.length + 2;
  let iteracoes = 0;

  while (iteracoes++ < maxIteracoes) {
    const plano = avancarExecucao(definicaoParaMotor, estados);

    if (plano.executar.length === 0) {
      if (plano.aguardandoHumano !== null) {
        await supabase
          .from("workflow_execucao_etapas")
          .update({ status: "aguardando_humano" })
          .eq("execucao_id", execucaoId)
          .eq("ordem", plano.aguardandoHumano);
        estados[plano.aguardandoHumano] = "aguardando_humano";
      }
      break;
    }

    for (const ordem of plano.executar) {
      const etapaAtual = ordenadas.find((e) => e.ordem === ordem);
      if (!etapaAtual) break;

      await supabase
        .from("workflow_execucao_etapas")
        .update({ status: "executando" })
        .eq("id", etapaAtual.id);

      try {
        const resultado = await executarAcaoDaEtapa(supabase, contexto, etapaAtual);
        await supabase
          .from("workflow_execucao_etapas")
          .update({ status: "concluida", resultado, executada_em: new Date().toISOString() })
          .eq("id", etapaAtual.id);
        estados[ordem] = "concluida";
      } catch (erro) {
        // Falha esperada (ErroEtapa: mensagem amigável) vs. bug/infra
        // (mensagem genérica ao usuário + log server com contexto real).
        const mensagem =
          erro instanceof ErroEtapa ? erro.message : "Falha inesperada ao executar a etapa. Tente novamente.";
        if (!(erro instanceof ErroEtapa)) {
          console.error("[workflows/cadeia] Falha:", erro, { execucaoId, ordem, tipo_acao: etapaAtual.tipo_acao });
        }
        await supabase
          .from("workflow_execucao_etapas")
          .update({
            status: "falha",
            resultado: { erro: mensagem },
            executada_em: new Date().toISOString(),
          })
          .eq("id", etapaAtual.id);
        estados[ordem] = "falha";
        // Contrato da Fase 8: cadeia PARA na primeira falha — as seguintes
        // permanecem pendentes e a EXECUÇÃO segue em_andamento (retry).
        return;
      }
    }
  }

  // Todas concluídas? Encerra a execução. Falha/aguardando mantêm em_andamento.
  const todasConcluidas = ordenadas.every(
    (etapaAtual) => estados[etapaAtual.ordem] === "concluida" || estados[etapaAtual.ordem] === undefined,
  );
  if (todasConcluidas && ordenadas.length > 0) {
    await supabase
      .from("workflow_execucoes")
      .update({ status: "concluida", concluida_em: new Date().toISOString() })
      .eq("id", execucaoId);
  }
}

/** Despacha a ação certa para a etapa, já normalizando a configuração salva. */
async function executarAcaoDaEtapa(
  supabase: Awaited<ReturnType<typeof createClient>>,
  contexto: ContextoExecucaoEtapa,
  etapaAtual: Pick<EtapaInstanciadaRow, "tipo_acao" | "configuracao">,
): Promise<Record<string, unknown>> {
  switch (etapaAtual.tipo_acao) {
    case "criar_tarefa":
      return executarCriarTarefa(
        supabase,
        contexto,
        normalizarConfiguracaoOuFalhar("criar_tarefa", etapaAtual.configuracao),
      );
    case "criar_prazo":
      return executarCriarPrazo(
        supabase,
        contexto,
        normalizarConfiguracaoOuFalhar("criar_prazo", etapaAtual.configuracao),
      );
    case "gerar_documento":
      return executarGerarDocumento(
        supabase,
        contexto,
        normalizarConfiguracaoOuFalhar("gerar_documento", etapaAtual.configuracao),
      );
    case "mensagem_portal":
      return executarMensagemPortal(
        supabase,
        contexto,
        normalizarConfiguracaoOuFalhar("mensagem_portal", etapaAtual.configuracao),
      );
    default:
      // aprovar_humano nunca chega aqui (motor pausa antes), mas fail-closed.
      throw new ErroEtapa("Etapa de aprovação humana não executa automaticamente.");
  }
}

function normalizarConfiguracaoOuFalhar<TTipo extends TipoAcaoWorkflow>(
  tipo: TTipo,
  bruta: Record<string, unknown>,
): Extract<ConfiguracaoAcao, { tipo_acao: TTipo }> {
  const normalizada = normalizarConfiguracaoAcao(tipo, bruta);
  if (!normalizada) throw new ErroEtapa("A configuração desta etapa ficou inválida — edite o workflow e tente de novo.");
  return normalizada as Extract<ConfiguracaoAcao, { tipo_acao: TTipo }>;
}

// ── Executores por tipo de ação ─────────────────────────────────────────

async function executarCriarTarefa(
  supabase: Awaited<ReturnType<typeof createClient>>,
  contexto: ContextoExecucaoEtapa,
  config: Extract<ConfiguracaoAcao, { tipo_acao: "criar_tarefa" }>,
): Promise<Record<string, unknown>> {
  // Campos mínimos de tarefas_caso (migration 0027 + prioridade da 0043):
  // defaults do banco cobrem status/prioridade; prazo_opcional é date nullable.
  const prazoOpcional =
    typeof config.prazo_dias === "number"
      ? adicionarDiasIso(new Date(), config.prazo_dias)
      : null;

  const { data, error } = await supabase
    .from("tarefas_caso")
    .insert({
      escritorio_id: contexto.escritorioId,
      ficha_caso_id: contexto.fichaCasoId,
      titulo: config.titulo_tarefa,
      responsavel_perfil_id: contexto.perfilId,
      status: "pendente",
      prioridade: "media",
      prazo_opcional: prazoOpcional,
      criado_por: contexto.perfilId,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) throw error ?? new ErroEtapa("Não foi possível criar a tarefa.");

  return { tarefa_id: data.id, prazo_opcional: prazoOpcional };
}

async function executarCriarPrazo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  contexto: ContextoExecucaoEtapa,
  config: Extract<ConfiguracaoAcao, { tipo_acao: "criar_prazo" }>,
): Promise<Record<string, unknown>> {
  // Prazos exigem só titulo+data_prazo (0001); origem 'manual' e
  // parte_contraria_tipo 'particular' são os defaults do banco — enviados
  // explícitos por clareza do contrato da Fase 8.
  const dataPrazo = adicionarDiasIso(new Date(), config.dias_apos_inicio);

  const { data, error } = await supabase
    .from("prazos")
    .insert({
      escritorio_id: contexto.escritorioId,
      criado_por: contexto.perfilId,
      ficha_caso_id: contexto.fichaCasoId,
      titulo: config.titulo_prazo,
      data_prazo: dataPrazo,
      origem: "manual",
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) throw error ?? new ErroEtapa("Não foi possível criar o prazo.");

  return { prazo_id: data.id, data_prazo: dataPrazo };
}

async function executarGerarDocumento(
  supabase: Awaited<ReturnType<typeof createClient>>,
  contexto: ContextoExecucaoEtapa,
  config: Extract<ConfiguracaoAcao, { tipo_acao: "gerar_documento" }>,
): Promise<Record<string, unknown>> {
  const fichaCasoId = contexto.fichaCasoId;

  // Mesma persistência e mesmos campos de
  // app/app/fichas/[id]/mail-merge-condicional-actions.ts (fonte de verdade
  // da feature de documento condicional) — REUSE, nunca schema inventado.
  const { data: modelo } = await supabase
    .from("modelos")
    .select("id, nome, conteudo")
    .eq("id", config.modelo_id)
    .maybeSingle<{ id: string; nome: string; conteudo: string }>();
  if (!modelo) throw new ErroEtapa("Modelo vinculado à etapa não foi encontrado (excluído?). Edite o workflow.");

  const { data: ficha } = await supabase
    .from("fichas_caso")
    .select("nome_cliente, area_direito, cliente_id")
    .eq("id", fichaCasoId)
    .maybeSingle<{ nome_cliente: string | null; area_direito: string | null; cliente_id: string | null }>();
  if (!ficha) throw new ErroEtapa("O caso desta execução não foi encontrado.");

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
      .eq("ficha_caso_id", fichaCasoId)
      .order("data_prazo", { ascending: true })
      .returns<PrazoParaTemplate[]>(),
    supabase
      .from("contratos_honorario")
      .select("id, tipo, valor_total, percentual_exito")
      .eq("ficha_caso_id", fichaCasoId)
      .order("criado_em", { ascending: false })
      .returns<(ContratoParaTemplate & { id: string })[]>(),
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

  let textoFinal: string;
  let naoResolvidas: string[];
  let variaveisUsadas: Record<string, string>;
  try {
    const resultadoMerge = resolverMailMergeCondicional(modelo.conteudo, dados);
    textoFinal = resultadoMerge.textoFinal;
    naoResolvidas = resultadoMerge.variaveisNaoResolvidas;
    variaveisUsadas = resultadoMerge.variaveisUsadas;
  } catch (erro) {
    // Erro de AUTORIA do modelo é falha amigável da etapa (usuário corrige o
    // modelo e usa Retry) — não um crash silencioso.
    if (erro instanceof MotorTemplateCondicionalError) {
      throw new ErroEtapa(`Erro na sintaxe do modelo "${modelo.nome}": ${erro.message}`);
    }
    throw erro;
  }

  const { data: documento, error: erroDocumento } = await supabase
    .from("documentos_condicionais_gerados")
    .insert({
      escritorio_id: contexto.escritorioId,
      modelo_id: modelo.id,
      ficha_caso_id: fichaCasoId,
      gerado_por: contexto.perfilId,
      variaveis_usadas: variaveisUsadas,
      variaveis_nao_resolvidas: naoResolvidas,
    })
    .select("id")
    .single<{ id: string }>();
  if (erroDocumento || !documento) throw erroDocumento ?? new ErroEtapa("Não foi possível registrar o documento gerado.");

  // O texto integral vive no registro de auditoria acima (via modelos) — na
  // etapa guardamos só preview + diagnóstico para não inflar o jsonb.
  return {
    documento_gerado_id: documento.id,
    modelo_nome: modelo.nome,
    variaveis_nao_resolvidas: naoResolvidas,
    texto_preview: textoFinal.slice(0, 4000),
  };
}

async function executarMensagemPortal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  contexto: ContextoExecucaoEtapa,
  config: Extract<ConfiguracaoAcao, { tipo_acao: "mensagem_portal" }>,
): Promise<Record<string, unknown>> {
  const fichaCasoId = contexto.fichaCasoId;

  // Schema REAL da feature portal (mensagens_portal_cliente, migration 0019):
  // mensagem exige cliente_portal vinculado à ficha — sem inventar tabela.
  const { data: clientesPortal } = await supabase
    .from("clientes_portal")
    .select("id")
    .eq("ficha_caso_id", fichaCasoId)
    .not("auth_user_id", "is", null)
    .returns<Array<{ id: string }>>();

  const destinatarios = clientesPortal ?? [];
  if (destinatarios.length === 0) {
    throw new ErroEtapa("Este caso não tem cliente ativo no portal — convide o cliente na ficha e reprocesse a etapa.");
  }

  const { error } = await supabase.from("mensagens_portal_cliente").insert(
    destinatarios.map((clientePortal) => ({
      escritorio_id: contexto.escritorioId,
      ficha_caso_id: fichaCasoId,
      cliente_portal_id: clientePortal.id,
      remetente: "escritorio" as const,
      conteudo: config.texto,
    })),
  );
  if (error) throw error;

  // Mesma política "fire and forget" de enviarMensagemEscritorioAction: a
  // notificação (sininho) não deve reverter a mensagem já gravada.
  await notificarClientePortal(supabase, {
    fichaCasoId,
    escritorioId: contexto.escritorioId,
    tipo: "mensagem_chat_portal",
    mensagem: `Nova mensagem do escritório: "${config.texto.slice(0, 120)}"`,
  });

  return { mensagens_enviadas: destinatarios.length };
}

/** Hoje (fuso do servidor) + N dias, no formato date do Postgres (YYYY-MM-DD). */
function adicionarDiasIso(base: Date, dias: number): string {
  const alvo = new Date(base.getTime());
  alvo.setDate(alvo.getDate() + dias);
  return alvo.toISOString().slice(0, 10);
}
