"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { extrairTextoDePdf } from "@/lib/rag/extrair-texto";
import { indexarTexto, removerIndexacao } from "@/lib/rag/ingestao";
import { reindexarTudoDoEscritorio } from "@/lib/rag/indexacao-interna";
import type { DocumentoConhecimento } from "@/lib/types";

const MAX_TAMANHO_ARQUIVO = 15 * 1024 * 1024; // 15MB
const TIPOS_ACEITOS = ["legislacao", "jurisprudencia", "doutrina", "outro"] as const;

export async function listarDocumentosAction(): Promise<DocumentoConhecimento[]> {
  const usuario = await getUsuarioAtual();
  if (!usuario) throw new Error("Não autenticado.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documentos_conhecimento")
    .select("*")
    .order("criado_em", { ascending: false });

  if (error) throw error;
  return (data as DocumentoConhecimento[]) ?? [];
}

export type ResultadoUpload = { ok: true } | { ok: false; error: string };

export async function uploadDocumentoAction(_prev: ResultadoUpload, formData: FormData): Promise<ResultadoUpload> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const arquivo = formData.get("arquivo");
  const tipoConteudoBruto = formData.get("tipoConteudo");

  const parsedTipo = z.enum(TIPOS_ACEITOS).safeParse(tipoConteudoBruto);
  if (!parsedTipo.success) return { ok: false, error: "Selecione um tipo de conteúdo válido." };

  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ok: false, error: "Selecione um arquivo (.pdf ou .txt)." };
  }
  if (arquivo.size > MAX_TAMANHO_ARQUIVO) {
    return { ok: false, error: "Arquivo muito grande (limite de 15MB)." };
  }

  const ehPdf = arquivo.type === "application/pdf" || arquivo.name.toLowerCase().endsWith(".pdf");
  const ehTexto = arquivo.type.startsWith("text/") || arquivo.name.toLowerCase().endsWith(".txt");
  if (!ehPdf && !ehTexto) {
    return { ok: false, error: "Formato não suportado. Envie um PDF ou um arquivo de texto (.txt)." };
  }

  const supabase = await createClient();
  const { escritorio_id: escritorioId, id: perfilId } = usuario.perfil;

  const { data: doc, error: erroInsert } = await supabase
    .from("documentos_conhecimento")
    .insert({
      escritorio_id: escritorioId,
      criado_por: perfilId,
      nome_arquivo: arquivo.name,
      tipo_conteudo: parsedTipo.data,
      status: "processando",
    })
    .select("id")
    .single();

  if (erroInsert || !doc) return { ok: false, error: "Não foi possível registrar o documento." };

  try {
    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    const texto = ehPdf ? await extrairTextoDePdf(bytes) : new TextDecoder("utf-8").decode(bytes);

    if (!texto.trim()) {
      throw new Error("Não foi possível extrair texto do arquivo (documento vazio ou digitalizado como imagem).");
    }

    const { totalChunks } = await indexarTexto(supabase, {
      escritorioId,
      fonteTipo: "documento_upload",
      fonteId: doc.id,
      texto,
      metadata: { nome_arquivo: arquivo.name },
    });

    await supabase
      .from("documentos_conhecimento")
      .update({ status: "pronto", total_chunks: totalChunks, processado_em: new Date().toISOString() })
      .eq("id", doc.id);
  } catch (erro) {
    await supabase
      .from("documentos_conhecimento")
      .update({
        status: "erro",
        erro: erro instanceof Error ? erro.message : "Erro desconhecido ao processar o documento.",
      })
      .eq("id", doc.id);
    revalidatePath("/app/base-conhecimento");
    return { ok: false, error: "Falha ao processar o documento. Veja o status na lista." };
  }

  revalidatePath("/app/base-conhecimento");
  return { ok: true };
}

export type ResultadoAcaoSimples = { ok: true } | { ok: false; error: string };

export async function excluirDocumentoAction(documentoId: string): Promise<ResultadoAcaoSimples> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const parsed = z.string().uuid().safeParse(documentoId);
  if (!parsed.success) return { ok: false, error: "Documento inválido." };

  const supabase = await createClient();
  await removerIndexacao(supabase, "documento_upload", parsed.data);
  const { error } = await supabase.from("documentos_conhecimento").delete().eq("id", parsed.data);
  if (error) return { ok: false, error: "Não foi possível excluir o documento." };

  revalidatePath("/app/base-conhecimento");
  return { ok: true };
}

export async function reindexarDadosInternosAction(): Promise<ResultadoAcaoSimples> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  try {
    await reindexarTudoDoEscritorio(supabase, usuario.perfil.escritorio_id);
  } catch {
    return { ok: false, error: "Falha ao reindexar os dados internos." };
  }

  revalidatePath("/app/base-conhecimento");
  return { ok: true };
}
