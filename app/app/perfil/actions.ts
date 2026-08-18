"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";

// Formato NÚMERO/UF (ex: "123456/SP") — é o que a API do DJEN espera como
// numeroOab + ufOab (ver lib/djen/cliente.ts), então valida aqui na origem
// em vez de deixar o cron descobrir um formato ruim uma vez por dia.
const oabSchema = z
  .string()
  .trim()
  .regex(/^\d{1,8}\/[A-Za-z]{2}$/, "Use o formato NÚMERO/UF, ex: 123456/SP.")
  .transform((valor) => valor.toUpperCase());

export type AtualizarOabState = { error: string | null; sucesso: string | null };

/**
 * Cadastro da OAB do próprio advogado — é o dado que liga o perfil à
 * sincronização automática de intimações do DJEN (lib/djen/sincronizar.ts
 * consulta `perfis.oab` de todo perfil ativo no cron diário).
 */
export async function atualizarOabAction(
  _prev: AtualizarOabState,
  formData: FormData,
): Promise<AtualizarOabState> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { error: "Sessão expirada. Faça login novamente.", sucesso: null };

  const bruto = formData.get("oab");
  if (typeof bruto === "string" && bruto.trim() === "") {
    const supabase = await createClient();
    const { error } = await supabase.from("perfis").update({ oab: null }).eq("id", usuario.perfil.id);
    if (error) return { error: "Não foi possível remover a OAB.", sucesso: null };
    revalidatePath("/app/perfil");
    return { error: null, sucesso: "OAB removida. A sincronização automática do DJEN foi desativada para você." };
  }

  const parsed = oabSchema.safeParse(bruto);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "OAB inválida.", sucesso: null };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("perfis").update({ oab: parsed.data }).eq("id", usuario.perfil.id);
  if (error) return { error: "Não foi possível salvar a OAB.", sucesso: null };

  revalidatePath("/app/perfil");
  return {
    error: null,
    sucesso: `OAB ${parsed.data} salva. As intimações novas serão importadas automaticamente 1x/dia como propostas de prazo para você aprovar.`,
  };
}
