"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import type { AnotacaoConversa } from "@/lib/types";

/**
 * Anotações colaborativas de EQUIPE numa conversa (ver migration 0054) —
 * comentário interno tipo "usar esse trecho na petição", nunca enviado ao
 * LLM (não faz parte do histórico de `lib/app/chat-shared.ts`). Qualquer
 * perfil do mesmo escritório vê e comenta; só o autor apaga a própria
 * anotação (reforçado por RLS, checado aqui só para devolver erro claro).
 */

const MAX_TAMANHO_ANOTACAO = 2000;

export async function listarAnotacoesAction(conversaId: string): Promise<AnotacaoConversa[]> {
  const usuario = await getUsuarioAtual();
  if (!usuario) throw new Error("Não autenticado.");

  const parsed = z.string().uuid().safeParse(conversaId);
  if (!parsed.success) throw new Error("Conversa inválida.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("anotacoes_conversa")
    .select("id, escritorio_id, conversa_id, autor_id, texto, criado_em, perfis(nome)")
    .eq("conversa_id", parsed.data)
    .order("criado_em", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((linha) => {
    const perfil = linha.perfis as unknown as { nome: string } | { nome: string }[] | null;
    const autorNome = Array.isArray(perfil) ? (perfil[0]?.nome ?? "—") : (perfil?.nome ?? "—");
    return {
      id: linha.id,
      escritorio_id: linha.escritorio_id,
      conversa_id: linha.conversa_id,
      autor_id: linha.autor_id,
      autor_nome: autorNome,
      texto: linha.texto,
      criado_em: linha.criado_em,
    };
  });
}

const criarAnotacaoSchema = z.object({
  conversaId: z.string().uuid(),
  texto: z.string().trim().min(1, "Digite uma anotação.").max(MAX_TAMANHO_ANOTACAO, "Anotação muito longa."),
});

export type ResultadoAnotacao = { ok: true; anotacao: AnotacaoConversa } | { ok: false; error: string };

export async function criarAnotacaoAction(conversaId: string, texto: string): Promise<ResultadoAnotacao> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const parsed = criarAnotacaoSchema.safeParse({ conversaId, texto });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("anotacoes_conversa")
    .insert({
      escritorio_id: usuario.perfil.escritorio_id,
      conversa_id: parsed.data.conversaId,
      autor_id: usuario.perfil.id,
      texto: parsed.data.texto,
    })
    .select("id, escritorio_id, conversa_id, autor_id, texto, criado_em")
    .single();

  if (error || !data) return { ok: false, error: "Não foi possível salvar a anotação." };

  revalidatePath("/app/chat");
  return {
    ok: true,
    anotacao: { ...data, autor_nome: usuario.perfil.nome },
  };
}

export type ResultadoExclusaoAnotacao = { ok: true } | { ok: false; error: string };

export async function excluirAnotacaoAction(anotacaoId: string): Promise<ResultadoExclusaoAnotacao> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const parsed = z.string().uuid().safeParse(anotacaoId);
  if (!parsed.success) return { ok: false, error: "Anotação inválida." };

  const supabase = await createClient();
  const { data: anotacao, error: erroBusca } = await supabase
    .from("anotacoes_conversa")
    .select("id, autor_id")
    .eq("id", parsed.data)
    .maybeSingle<{ id: string; autor_id: string }>();
  if (erroBusca) return { ok: false, error: "Não foi possível localizar a anotação." };
  if (!anotacao) return { ok: false, error: "Anotação não encontrada." };
  if (anotacao.autor_id !== usuario.perfil.id) {
    return { ok: false, error: "Você só pode excluir anotações criadas por você." };
  }

  const { error } = await supabase.from("anotacoes_conversa").delete().eq("id", parsed.data);
  if (error) return { ok: false, error: "Não foi possível excluir a anotação." };

  revalidatePath("/app/chat");
  return { ok: true };
}
