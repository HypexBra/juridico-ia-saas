"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getAdminAtual } from "@/lib/admin/auth";
import { registrarLogAdmin } from "@/lib/admin/log";
import { createClient } from "@/lib/supabase/server";
import { cifrarChaveIa, mascararChaveParaPreview } from "./criptografia";
import type { ChaveIaAdmin } from "./tipos";

export type GestaoChaveResultado = { ok: true; mensagem: string } | { ok: false; error: string };

/**
 * Lista as chaves de provedores de IA para a tela /admin/ia-chaves —
 * SEMPRE via a view `ia_provider_chaves_admin` (migration 0032), que não
 * expõe `chave_cifrada` — nunca a tabela base. Estruturalmente impossível a
 * UI de gestão vazar o ciphertext, mesmo que um bug futuro tente `select *`.
 */
export async function listarChavesIa(): Promise<ChaveIaAdmin[]> {
  const admin = await getAdminAtual();
  if (!admin) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ia_provider_chaves_admin")
    .select("*")
    .order("provider", { ascending: true })
    .order("ordem", { ascending: true })
    .returns<ChaveIaAdmin[]>();

  if (error) {
    console.error("[ia/chaves/gestao-actions] Falha ao listar chaves:", error.message);
    return [];
  }
  return data ?? [];
}

const criarChaveSchema = z.object({
  provider: z.enum(["gemini", "groq"]),
  nome: z.string().trim().min(1, "Informe um nome para identificar a chave.").max(100),
  chave: z.string().trim().min(10, "Chave inválida (muito curta)."),
  rpmLimite: z.coerce.number().int().positive("Informe o limite de requisições por minuto (rpm) do provedor."),
});

/**
 * Cria uma nova chave no pool: cifra no SERVIDOR antes de gravar (nunca
 * recebe/retorna a chave em texto puro após este ponto) e grava também
 * `chave_preview` (mascarada, uma vez, na criação — nunca decifrando de
 * novo depois). Fail-closed: confirma explicitamente ser admin de
 * plataforma antes de qualquer outra validação/gravação, mesmo mo caminho
 * mais rápido de retorno.
 */
export async function criarChaveIa(
  _prev: GestaoChaveResultado | null,
  formData: FormData,
): Promise<GestaoChaveResultado> {
  const admin = await getAdminAtual();
  if (!admin) return { ok: false, error: "Não autorizado." };

  const parsed = criarChaveSchema.safeParse({
    provider: formData.get("provider"),
    nome: formData.get("nome"),
    chave: formData.get("chave"),
    rpmLimite: formData.get("rpmLimite"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { provider, nome, chave, rpmLimite } = parsed.data;
  const chaveCifrada = cifrarChaveIa(chave);
  const chavePreview = mascararChaveParaPreview(chave);

  const supabase = await createClient();
  const { error } = await supabase.from("ia_provider_chaves").insert({
    provider,
    nome,
    chave_cifrada: chaveCifrada,
    chave_preview: chavePreview,
    rpm_limite: rpmLimite,
  });

  if (error) {
    console.error("[ia/chaves/gestao-actions] Falha ao criar chave:", error.message);
    return { ok: false, error: "Não foi possível cadastrar a chave." };
  }

  await registrarLogAdmin(admin, {
    acao: "criar_chave_ia",
    alvoTipo: "ia_provider_chave",
    detalhes: { provider, nome, chavePreview },
  });

  revalidatePath("/admin/ia-chaves");
  return { ok: true, mensagem: `Chave "${nome}" (${provider}) cadastrada com sucesso.` };
}

/**
 * Desativa manualmente uma chave (`status = 'desativada_manual'`) — só
 * reativa por ação explícita de um admin (nunca automático, diferente do
 * cooldown por quota). Usado tanto para desativar quanto para reativar.
 */
export async function desativarChaveIa(chaveId: string, ativar: boolean): Promise<GestaoChaveResultado> {
  const admin = await getAdminAtual();
  if (!admin) return { ok: false, error: "Não autorizado." };

  const parsed = z.string().uuid().safeParse(chaveId);
  if (!parsed.success) return { ok: false, error: "Chave inválida." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("ia_provider_chaves")
    .update(
      ativar
        ? { status: "ativa", disponivel_em: new Date().toISOString(), atualizado_em: new Date().toISOString() }
        : { status: "desativada_manual", atualizado_em: new Date().toISOString() },
    )
    .eq("id", parsed.data);

  if (error) {
    console.error("[ia/chaves/gestao-actions] Falha ao atualizar status da chave:", error.message);
    return { ok: false, error: "Não foi possível atualizar a chave." };
  }

  await registrarLogAdmin(admin, {
    acao: ativar ? "ativar_chave_ia" : "desativar_chave_ia",
    alvoTipo: "ia_provider_chave",
    alvoId: parsed.data,
  });

  revalidatePath("/admin/ia-chaves");
  return { ok: true, mensagem: ativar ? "Chave reativada." : "Chave desativada." };
}
