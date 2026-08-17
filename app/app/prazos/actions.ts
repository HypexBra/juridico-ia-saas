"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";

const criarPrazoSchema = z.object({
  titulo: z.string().trim().min(1, "Informe o título do prazo."),
  descricao: z.string().trim().optional(),
  dataPrazo: z.string().trim().min(1, "Informe a data."),
  processo: z.string().trim().optional(),
  clienteNome: z.string().trim().optional(),
});

export type CriarPrazoState = { error: string | null };

export async function criarPrazoAction(
  _prev: CriarPrazoState,
  formData: FormData,
): Promise<CriarPrazoState> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { error: "Sessão expirada. Faça login novamente." };

  const parsed = criarPrazoSchema.safeParse({
    titulo: formData.get("titulo"),
    descricao: formData.get("descricao") || undefined,
    dataPrazo: formData.get("dataPrazo"),
    processo: formData.get("processo") || undefined,
    clienteNome: formData.get("clienteNome") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("prazos").insert({
    escritorio_id: usuario.perfil.escritorio_id,
    criado_por: usuario.perfil.id,
    titulo: parsed.data.titulo,
    descricao: parsed.data.descricao ?? null,
    data_prazo: parsed.data.dataPrazo,
    processo: parsed.data.processo ?? null,
    cliente_nome: parsed.data.clienteNome ?? null,
  });

  if (error) return { error: "Não foi possível salvar o prazo. Tente novamente." };

  revalidatePath("/app/prazos");
  revalidatePath("/app/dashboard");
  return { error: null };
}

export type AcaoPrazoResultado = { ok: true } | { ok: false; error: string };

export async function concluirPrazoAction(
  prazoId: string,
  concluido: boolean,
): Promise<AcaoPrazoResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  const { error } = await supabase.from("prazos").update({ concluido }).eq("id", prazoId);

  if (error) {
    return { ok: false, error: "Não foi possível atualizar o prazo. Tente novamente." };
  }

  revalidatePath("/app/prazos");
  revalidatePath("/app/dashboard");
  return { ok: true };
}

export async function excluirPrazoAction(prazoId: string): Promise<AcaoPrazoResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  const { error } = await supabase.from("prazos").delete().eq("id", prazoId);

  if (error) {
    return { ok: false, error: "Não foi possível excluir o prazo. Tente novamente." };
  }

  revalidatePath("/app/prazos");
  revalidatePath("/app/dashboard");
  return { ok: true };
}
