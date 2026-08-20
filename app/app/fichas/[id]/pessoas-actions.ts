"use server";

import { revalidatePath } from "next/cache";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import {
  pessoaCasoInputSchema,
  pessoaCasoUpdateSchema,
  montarPayloadPessoaCaso,
  montarPayloadParcialPessoaCaso,
  type PessoaCasoInput,
  type PessoaCasoUpdateInput,
} from "@/lib/casos/pessoas";
import type { PessoaCaso } from "@/lib/types";

export type ListarPessoasCasoResultado =
  | { ok: true; pessoas: PessoaCaso[] }
  | { ok: false; error: string };

/**
 * Lista as pessoas envolvidas no caso (partes, adverso, testemunhas,
 * terceiros) de uma ficha, ordenadas por data de criação (mais antigas
 * primeiro — ordem em que foram cadastradas na triagem/instrução do caso).
 * RLS de `pessoas_caso` (`escritorio_id = escritorio_atual()`) já garante
 * isolamento por tenant; o filtro por `ficha_caso_id` aqui é só para
 * restringir à ficha aberta na tela.
 */
export async function listarPessoasCasoAction(fichaCasoId: string): Promise<ListarPessoasCasoResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pessoas_caso")
    .select("*")
    .eq("ficha_caso_id", fichaCasoId)
    .order("criado_em", { ascending: true })
    .returns<PessoaCaso[]>();

  if (error) {
    console.error("[pessoas-actions/listarPessoasCasoAction] Falha ao listar pessoas do caso:", error, {
      fichaCasoId,
    });
    return { ok: false, error: "Não foi possível carregar as pessoas do caso. Tente novamente." };
  }

  return { ok: true, pessoas: data ?? [] };
}

export type PessoaCasoActionResultado = { ok: true; pessoa: PessoaCaso } | { ok: false; error: string };

/**
 * Confirma que a ficha existe e é visível ao usuário logado (RLS de
 * `fichas_caso` já restringe ao escritório atual) antes de vincular uma
 * pessoa a ela — evita criar uma linha em `pessoas_caso` com
 * `ficha_caso_id` de uma ficha inexistente/de outro tenant (a RLS de
 * `pessoas_caso` sozinha não valida a que tenant o `ficha_caso_id`
 * pertence, só o `escritorio_id` da própria linha).
 */
async function fichaExisteEVisivel(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fichaCasoId: string,
): Promise<boolean> {
  const { data, error } = await supabase.from("fichas_caso").select("id").eq("id", fichaCasoId).maybeSingle();
  if (error) {
    console.error("[pessoas-actions/fichaExisteEVisivel] Falha ao verificar ficha:", error, { fichaCasoId });
    return false;
  }
  return data !== null;
}

/**
 * Cria uma pessoa do caso (parte, adverso, testemunha ou terceiro)
 * vinculada à ficha aberta na tela.
 */
export async function criarPessoaCasoAction(
  fichaCasoId: string,
  dados: PessoaCasoInput,
): Promise<PessoaCasoActionResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const parsed = pessoaCasoInputSchema.safeParse(dados);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();

  if (!(await fichaExisteEVisivel(supabase, fichaCasoId))) {
    return { ok: false, error: "Ficha não encontrada." };
  }

  const payload = montarPayloadPessoaCaso(parsed.data);
  const { data, error } = await supabase
    .from("pessoas_caso")
    .insert({
      escritorio_id: usuario.perfil.escritorio_id,
      ficha_caso_id: fichaCasoId,
      ...payload,
    })
    .select("*")
    .single<PessoaCaso>();

  if (error || !data) {
    console.error("[pessoas-actions/criarPessoaCasoAction] Falha ao criar pessoa do caso:", error, {
      fichaCasoId,
    });
    return { ok: false, error: "Não foi possível salvar a pessoa do caso. Tente novamente." };
  }

  revalidatePath(`/app/fichas/${fichaCasoId}`);
  return { ok: true, pessoa: data };
}

/**
 * Atualiza uma pessoa do caso já existente (atualização parcial — só os
 * campos presentes em `dados` são alterados). `atualizado_em` é sempre
 * setado explicitamente porque a migration 0023 não tem trigger de
 * `updated_at` automático nesta tabela.
 */
export async function atualizarPessoaCasoAction(
  pessoaId: string,
  dados: PessoaCasoUpdateInput,
): Promise<PessoaCasoActionResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const parsed = pessoaCasoUpdateSchema.safeParse(dados);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const payload = montarPayloadParcialPessoaCaso(parsed.data);
  if (Object.keys(payload).length === 0) {
    return { ok: false, error: "Nenhum dado para atualizar." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pessoas_caso")
    .update({ ...payload, atualizado_em: new Date().toISOString() })
    .eq("id", pessoaId)
    .select("*")
    .single<PessoaCaso>();

  if (error || !data) {
    console.error("[pessoas-actions/atualizarPessoaCasoAction] Falha ao atualizar pessoa do caso:", error, {
      pessoaId,
    });
    return { ok: false, error: "Não foi possível atualizar a pessoa do caso. Tente novamente." };
  }

  revalidatePath(`/app/fichas/${data.ficha_caso_id}`);
  return { ok: true, pessoa: data };
}

export type AcaoPessoaCasoResultado = { ok: true } | { ok: false; error: string };

/** Remove (DELETE físico — não há soft delete para `pessoas_caso`) uma pessoa do caso. */
export async function removerPessoaCasoAction(pessoaId: string): Promise<AcaoPessoaCasoResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pessoas_caso")
    .delete()
    .eq("id", pessoaId)
    .select("ficha_caso_id")
    .maybeSingle<{ ficha_caso_id: string }>();

  if (error) {
    console.error("[pessoas-actions/removerPessoaCasoAction] Falha ao remover pessoa do caso:", error, {
      pessoaId,
    });
    return { ok: false, error: "Não foi possível remover a pessoa do caso. Tente novamente." };
  }

  if (!data) {
    return { ok: false, error: "Pessoa do caso não encontrada." };
  }

  revalidatePath(`/app/fichas/${data.ficha_caso_id}`);
  return { ok: true };
}
