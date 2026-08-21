"use server";

import { revalidatePath } from "next/cache";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import {
  montarAtualizacaoStatusTarefa,
  montarNovaTarefaCaso,
  validarResponsavelTarefaCaso,
} from "@/lib/casos/tarefas";
import type { TarefaCaso } from "@/lib/types";

export type ListarTarefasCasoResultado =
  | { ok: true; tarefas: TarefaCaso[] }
  | { ok: false; error: string };

/**
 * Lista as tarefas (checklist operacional) de uma ficha, mais antigas
 * primeiro — reflete a ordem natural de execução do trabalho no caso. O
 * isolamento por escritório é garantido pela RLS (`tarefas_caso_isolamento`,
 * migration 0027), não precisa ser repetido no filtro aqui.
 */
export async function listarTarefasCasoAction(fichaCasoId: string): Promise<ListarTarefasCasoResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tarefas_caso")
    .select("*")
    .eq("ficha_caso_id", fichaCasoId)
    .order("criado_em", { ascending: true });

  if (error) {
    console.error("[fichas/tarefas-actions] Falha ao listar tarefas do caso:", error, { fichaCasoId });
    return { ok: false, error: "Não foi possível carregar as tarefas do caso. Tente novamente." };
  }

  return { ok: true, tarefas: (data ?? []) as TarefaCaso[] };
}

export type NovaTarefaCasoFormInput = {
  titulo: string;
  responsavelPerfilId?: string | null;
  prazoOpcional?: string | null;
};

export type CriarTarefaCasoResultado = { ok: true; tarefa: TarefaCaso } | { ok: false; error: string };

/**
 * Cria uma nova tarefa (item de checklist interno) vinculada à ficha.
 * Distinta de `prazos`: não tem regra de dobra processual, é só trabalho
 * operacional da equipe. O título é validado por `montarNovaTarefaCaso`
 * (função pura, testável sem banco) antes de qualquer round-trip.
 *
 * Achado de revisão de segurança (Fase 6, Estrategista): diferente de
 * update/delete (que sempre fazem um SELECT prévio por `id` já protegido
 * pela RLS de `tarefas_caso`), um INSERT define `escritorio_id` a partir da
 * PRÓPRIA sessão — passa a RLS mesmo se `fichaCasoId` apontar para uma
 * ficha de OUTRO escritório (a FK só garante que a ficha existe em algum
 * lugar, não que pertence a quem está chamando). Sem esta checagem
 * explícita, um usuário autenticado que descobrisse o `fichaCasoId` de
 * outro tenant (ex.: enumeração de UUID) podia inserir uma tarefa cruzando
 * `escritorio_id` (o dele) com `ficha_caso_id` (de outro escritório).
 */
export async function criarTarefaCasoAction(
  fichaCasoId: string,
  dados: NovaTarefaCasoFormInput,
): Promise<CriarTarefaCasoResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  const { data: fichaVisivel, error: erroFicha } = await supabase
    .from("fichas_caso")
    .select("id")
    .eq("id", fichaCasoId)
    .eq("escritorio_id", usuario.perfil.escritorio_id)
    .maybeSingle();
  if (erroFicha || !fichaVisivel) {
    return { ok: false, error: "Ficha não encontrada." };
  }

  let payload;
  try {
    payload = montarNovaTarefaCaso({
      escritorioId: usuario.perfil.escritorio_id,
      fichaCasoId,
      titulo: dados.titulo,
      responsavelPerfilId: dados.responsavelPerfilId ?? null,
      prazoOpcional: dados.prazoOpcional ?? null,
      criadoPor: usuario.perfil.id,
    });
  } catch (erro) {
    return { ok: false, error: erro instanceof Error ? erro.message : "Dados inválidos." };
  }

  const { data, error } = await supabase.from("tarefas_caso").insert(payload).select("*").single();

  if (error || !data) {
    console.error("[fichas/tarefas-actions] Falha ao criar tarefa do caso:", error, { fichaCasoId });
    return { ok: false, error: "Não foi possível criar a tarefa. Tente novamente." };
  }

  revalidatePath(`/app/fichas/${fichaCasoId}`);
  return { ok: true, tarefa: data as TarefaCaso };
}

export type AcaoTarefaCasoResultado = { ok: true } | { ok: false; error: string };

/**
 * Atualiza o status de uma tarefa (`pendente` -> `em_andamento` ->
 * `concluida`, ou de volta). A validação de enum e de transição redundante
 * roda em `montarAtualizacaoStatusTarefa` antes do update; a tarefa atual é
 * buscada primeiro (escopada pela RLS do escritório) para saber o status
 * vigente e para poder revalidar a página certa da ficha depois.
 */
export async function atualizarStatusTarefaCasoAction(
  tarefaId: string,
  status: string,
): Promise<AcaoTarefaCasoResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  const { data: tarefaAtual, error: erroBusca } = await supabase
    .from("tarefas_caso")
    .select("status, ficha_caso_id")
    .eq("id", tarefaId)
    .maybeSingle<{ status: TarefaCaso["status"]; ficha_caso_id: string }>();

  if (erroBusca || !tarefaAtual) return { ok: false, error: "Tarefa não encontrada." };

  let payload;
  try {
    payload = montarAtualizacaoStatusTarefa({ statusAtual: tarefaAtual.status, novoStatus: status });
  } catch (erro) {
    return { ok: false, error: erro instanceof Error ? erro.message : "Status inválido." };
  }

  const { error } = await supabase
    .from("tarefas_caso")
    .update({ status: payload.status, atualizado_em: new Date().toISOString() })
    .eq("id", tarefaId);

  if (error) {
    console.error("[fichas/tarefas-actions] Falha ao atualizar status da tarefa:", error, { tarefaId });
    return { ok: false, error: "Não foi possível atualizar o status da tarefa. Tente novamente." };
  }

  revalidatePath(`/app/fichas/${tarefaAtual.ficha_caso_id}`);
  return { ok: true };
}

/**
 * Atribui (ou remove, quando `perfilId` é `null`) o responsável de uma
 * tarefa. A existência do perfil e o isolamento por escritório são
 * garantidos pela FK/RLS do banco (`responsavel_perfil_id references
 * perfis`) — aqui só validamos que, quando informado, o id não é uma string
 * vazia/em branco.
 */
export async function atribuirResponsavelTarefaCasoAction(
  tarefaId: string,
  perfilId: string | null,
): Promise<AcaoTarefaCasoResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  let responsavelPerfilId: string | null;
  try {
    responsavelPerfilId = validarResponsavelTarefaCaso(perfilId);
  } catch (erro) {
    return { ok: false, error: erro instanceof Error ? erro.message : "Responsável inválido." };
  }

  const supabase = await createClient();
  const { data: tarefaAtual, error: erroBusca } = await supabase
    .from("tarefas_caso")
    .select("ficha_caso_id")
    .eq("id", tarefaId)
    .maybeSingle<{ ficha_caso_id: string }>();

  if (erroBusca || !tarefaAtual) return { ok: false, error: "Tarefa não encontrada." };

  const { error } = await supabase
    .from("tarefas_caso")
    .update({ responsavel_perfil_id: responsavelPerfilId, atualizado_em: new Date().toISOString() })
    .eq("id", tarefaId);

  if (error) {
    console.error("[fichas/tarefas-actions] Falha ao atribuir responsável da tarefa:", error, { tarefaId });
    return { ok: false, error: "Não foi possível atribuir o responsável. Tente novamente." };
  }

  revalidatePath(`/app/fichas/${tarefaAtual.ficha_caso_id}`);
  return { ok: true };
}

/**
 * Remove uma tarefa do checklist do caso. Diferente das fichas (que têm
 * exclusão lógica em `excluirFichaAction`), tarefa operacional é hard-delete
 * mesmo: não há valor jurídico/auditável em manter um item de checklist
 * removido pela equipe.
 */
export async function removerTarefaCasoAction(tarefaId: string): Promise<AcaoTarefaCasoResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  const { data: tarefaAtual, error: erroBusca } = await supabase
    .from("tarefas_caso")
    .select("ficha_caso_id")
    .eq("id", tarefaId)
    .maybeSingle<{ ficha_caso_id: string }>();

  if (erroBusca || !tarefaAtual) return { ok: false, error: "Tarefa não encontrada." };

  const { error } = await supabase.from("tarefas_caso").delete().eq("id", tarefaId);

  if (error) {
    console.error("[fichas/tarefas-actions] Falha ao remover tarefa do caso:", error, { tarefaId });
    return { ok: false, error: "Não foi possível remover a tarefa. Tente novamente." };
  }

  revalidatePath(`/app/fichas/${tarefaAtual.ficha_caso_id}`);
  return { ok: true };
}
