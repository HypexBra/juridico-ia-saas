"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { criptografarToken } from "@/lib/whatsapp/criptografia";

const canalSchema = z.object({
  phoneNumberId: z.string().trim().min(1, "Informe o Phone Number ID da Meta Cloud API."),
  numeroExibicao: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => (v ? v : null)),
  // Vazio = "não alterar o token já salvo" (edição sem trocar credencial);
  // só entra na criptografia/gravação quando o admin digita um valor novo.
  tokenAcesso: z.string().trim().optional(),
});

export type CanalWhatsappState = { error: string | null; sucesso: string | null };

/**
 * Cadastra/atualiza a credencial do canal WhatsApp (Meta Cloud API) do
 * escritório. Autorização real é feita pela RLS `canais_whatsapp_admin`
 * (migration 0008) — só owner/admin conseguem inserir/atualizar essa linha;
 * qualquer outro papel recebe erro de política do Postgres, tratado aqui
 * como mensagem genérica (nunca vazamos o texto cru do erro do Postgres
 * pro usuário final).
 *
 * O `token_acesso` NUNCA é gravado em texto puro — sempre passa por
 * `criptografarToken` (AES-256-GCM, `lib/whatsapp/criptografia.ts`) antes do
 * insert/update, e só é decriptografado no momento de chamar a Meta Cloud
 * API (`lib/whatsapp/enviar.ts`).
 */
export async function salvarCanalWhatsappAction(
  _prev: CanalWhatsappState,
  formData: FormData,
): Promise<CanalWhatsappState> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { error: "Sessão expirada. Faça login novamente.", sucesso: null };

  if (usuario.perfil.role !== "owner" && usuario.perfil.role !== "admin") {
    return { error: "Só o titular ou administradores podem configurar o canal WhatsApp.", sucesso: null };
  }

  const parsed = canalSchema.safeParse({
    phoneNumberId: formData.get("phoneNumberId"),
    numeroExibicao: formData.get("numeroExibicao"),
    tokenAcesso: formData.get("tokenAcesso"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos.", sucesso: null };
  }

  const supabase = await createClient();

  const { data: existente } = await supabase
    .from("canais_whatsapp_escritorio")
    .select("id")
    .eq("escritorio_id", usuario.perfil.escritorio_id)
    .maybeSingle();

  if (!existente && !parsed.data.tokenAcesso) {
    return { error: "Informe o token de acesso da Meta Cloud API para cadastrar o canal.", sucesso: null };
  }

  const dadosBase = {
    escritorio_id: usuario.perfil.escritorio_id,
    phone_number_id: parsed.data.phoneNumberId,
    numero_exibicao: parsed.data.numeroExibicao,
    ativo: true,
    atualizado_em: new Date().toISOString(),
  };

  const dados = parsed.data.tokenAcesso
    ? { ...dadosBase, token_acesso: criptografarToken(parsed.data.tokenAcesso) }
    : dadosBase;

  const { error } = existente
    ? await supabase.from("canais_whatsapp_escritorio").update(dados).eq("id", existente.id)
    : await supabase.from("canais_whatsapp_escritorio").insert(dados);

  if (error) {
    return { error: "Não foi possível salvar o canal WhatsApp. Verifique suas permissões e tente novamente.", sucesso: null };
  }

  revalidatePath("/app/perfil");
  return {
    error: null,
    sucesso: "Canal WhatsApp salvo. Os lembretes automáticos de prazo e parcela passam a valer no próximo ciclo do cron.",
  };
}

/** Desativa o canal sem apagar a credencial — reversível a qualquer momento reativando. */
export async function alternarCanalWhatsappAction(
  _prev: CanalWhatsappState,
  formData: FormData,
): Promise<CanalWhatsappState> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { error: "Sessão expirada. Faça login novamente.", sucesso: null };

  if (usuario.perfil.role !== "owner" && usuario.perfil.role !== "admin") {
    return { error: "Só o titular ou administradores podem alterar o canal WhatsApp.", sucesso: null };
  }

  const ativar = formData.get("ativar") === "true";
  const supabase = await createClient();
  const { error } = await supabase
    .from("canais_whatsapp_escritorio")
    .update({ ativo: ativar, atualizado_em: new Date().toISOString() })
    .eq("escritorio_id", usuario.perfil.escritorio_id);

  if (error) return { error: "Não foi possível atualizar o canal.", sucesso: null };

  revalidatePath("/app/perfil");
  return { error: null, sucesso: ativar ? "Canal reativado." : "Canal desativado. Os lembretes automáticos param de ser enviados." };
}
