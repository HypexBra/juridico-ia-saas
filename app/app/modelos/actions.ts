"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { AREAS_DIREITO } from "@/lib/types";

const modeloSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome do modelo."),
  area: z.enum(AREAS_DIREITO).optional(),
  tipo: z.string().trim().optional(),
  descricao: z.string().trim().optional(),
  conteudo: z.string().trim().min(1, "O conteúdo do modelo não pode ficar vazio."),
});

export type ModeloFormState = { error: string | null };

export async function criarModeloAction(
  _prev: ModeloFormState,
  formData: FormData,
): Promise<ModeloFormState> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { error: "Sessão expirada. Faça login novamente." };

  const parsed = modeloSchema.safeParse({
    nome: formData.get("nome"),
    area: formData.get("area") || undefined,
    tipo: formData.get("tipo") || undefined,
    descricao: formData.get("descricao") || undefined,
    conteudo: formData.get("conteudo"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();
  const { data: modelo, error } = await supabase
    .from("modelos")
    .insert({
      escritorio_id: usuario.perfil.escritorio_id,
      criado_por: usuario.perfil.id,
      nome: parsed.data.nome,
      area: parsed.data.area ?? null,
      tipo: parsed.data.tipo ?? null,
      descricao: parsed.data.descricao ?? null,
      conteudo: parsed.data.conteudo,
    })
    .select("id")
    .single();

  if (error || !modelo) return { error: "Não foi possível salvar o modelo. Tente novamente." };

  revalidatePath("/app/modelos");
  redirect(`/app/modelos/${modelo.id}`);
}

export async function atualizarModeloAction(
  modeloId: string,
  _prev: ModeloFormState,
  formData: FormData,
): Promise<ModeloFormState> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { error: "Sessão expirada. Faça login novamente." };

  const parsed = modeloSchema.safeParse({
    nome: formData.get("nome"),
    area: formData.get("area") || undefined,
    tipo: formData.get("tipo") || undefined,
    descricao: formData.get("descricao") || undefined,
    conteudo: formData.get("conteudo"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("modelos")
    .update({
      nome: parsed.data.nome,
      area: parsed.data.area ?? null,
      tipo: parsed.data.tipo ?? null,
      descricao: parsed.data.descricao ?? null,
      conteudo: parsed.data.conteudo,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", modeloId);

  if (error) return { error: "Não foi possível atualizar o modelo. Tente novamente." };

  revalidatePath("/app/modelos");
  revalidatePath(`/app/modelos/${modeloId}`);
  return { error: null };
}

export type AcaoModeloResultado = { ok: true } | { ok: false; error: string };

export async function excluirModeloAction(modeloId: string): Promise<AcaoModeloResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  const { error } = await supabase.from("modelos").delete().eq("id", modeloId);

  if (error) {
    return { ok: false, error: "Não foi possível excluir o modelo. Tente novamente." };
  }

  revalidatePath("/app/modelos");
  redirect("/app/modelos");
}
