"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { gerarDocx } from "@/lib/documentos/gerar-docx";
import { gerarPdf } from "@/lib/documentos/gerar-pdf";
import { autentiqueEstaConfigurado, criarDocumentoParaAssinatura } from "@/lib/assinatura/autentique";
import type { DocumentoParaAssinatura, Modelo, SignatarioDocumento } from "@/lib/types";

const signatarioSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome de todos os signatários."),
  email: z.string().trim().email("Um dos e-mails de signatário é inválido."),
});

const enviarAssinaturaSchema = z.object({
  formato: z.enum(["docx", "pdf"]),
  signatarios: z.array(signatarioSchema).min(1, "Adicione ao menos um signatário."),
});

export type EnviarAssinaturaState = { error: string | null; ok: boolean };

/**
 * Gera o documento a partir do modelo salvo e envia para assinatura
 * eletrônica via Autentique. Cria a linha em `documentos_para_assinatura`
 * ANTES de chamar o provedor (status 'rascunho') pra nunca perder o registro
 * se a chamada de rede falhar; em caso de falha do provedor, o registro fica
 * como 'rascunho' — visível na UI como "não enviado", nunca como algo que
 * enganosamente parece ter sido enviado.
 */
export async function enviarModeloParaAssinaturaAction(
  modeloId: string,
  _prev: EnviarAssinaturaState,
  formData: FormData,
): Promise<EnviarAssinaturaState> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { error: "Sessão expirada. Faça login novamente.", ok: false };

  if (!autentiqueEstaConfigurado()) {
    return {
      error: "Assinatura eletrônica não está configurada neste ambiente (defina AUTENTIQUE_API_TOKEN).",
      ok: false,
    };
  }

  let signatariosBrutos: unknown;
  try {
    signatariosBrutos = JSON.parse(String(formData.get("signatarios") ?? "[]"));
  } catch {
    return { error: "Lista de signatários inválida.", ok: false };
  }

  const parsed = enviarAssinaturaSchema.safeParse({
    formato: formData.get("formato"),
    signatarios: signatariosBrutos,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos.", ok: false };
  }

  const supabase = await createClient();
  const { data: modelo } = await supabase
    .from("modelos")
    .select("*")
    .eq("id", modeloId)
    .maybeSingle<Modelo>();
  if (!modelo) return { error: "Modelo não encontrado.", ok: false };

  const arquivo =
    parsed.data.formato === "pdf"
      ? await gerarPdf(modelo.nome, modelo.conteudo)
      : await gerarDocx(modelo.nome, modelo.conteudo);
  const nomeBase = modelo.nome.replace(/[^\w\-À-ÿ ]/g, "").trim() || "documento";
  const nomeArquivo = `${nomeBase}.${parsed.data.formato}`;

  const signatariosIniciais: SignatarioDocumento[] = parsed.data.signatarios.map((s) => ({
    nome: s.nome,
    email: s.email,
    status: "pendente",
  }));

  const { data: registro, error: erroInsercao } = await supabase
    .from("documentos_para_assinatura")
    .insert({
      escritorio_id: usuario.perfil.escritorio_id,
      criado_por: usuario.perfil.id,
      modelo_id: modelo.id,
      nome_documento: modelo.nome,
      status: "rascunho",
      signatarios: signatariosIniciais,
    })
    .select("*")
    .single<DocumentoParaAssinatura>();

  if (erroInsercao || !registro) {
    return { error: "Não foi possível registrar o documento para assinatura.", ok: false };
  }

  const resultado = await criarDocumentoParaAssinatura({
    nomeDocumento: modelo.nome,
    arquivo,
    nomeArquivo,
    formato: parsed.data.formato,
    signatarios: parsed.data.signatarios,
  });

  if (!resultado.ok) {
    return { error: `Falha ao enviar para o Autentique: ${resultado.error}`, ok: false };
  }

  const { error: erroUpdate } = await supabase
    .from("documentos_para_assinatura")
    .update({
      status: "aguardando_assinatura",
      arquivo_gerado_em: new Date().toISOString(),
      provedor: "autentique",
      id_externo_provedor: resultado.idExterno,
    })
    .eq("id", registro.id);

  if (erroUpdate) {
    return {
      error: "Documento foi enviado ao Autentique, mas houve falha ao salvar o status localmente.",
      ok: false,
    };
  }

  revalidatePath(`/app/modelos/${modeloId}`);
  return { error: null, ok: true };
}

export async function listarDocumentosAssinaturaDoModeloAction(
  modeloId: string,
): Promise<DocumentoParaAssinatura[]> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("documentos_para_assinatura")
    .select("*")
    .eq("modelo_id", modeloId)
    .order("criado_em", { ascending: false })
    .returns<DocumentoParaAssinatura[]>();

  return data ?? [];
}
