"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { planoTemAcesso } from "@/lib/planos/gating";
import {
  existeProcessamentoIaEmAndamento,
  MENSAGEM_PROCESSAMENTO_IA_EM_ANDAMENTO,
} from "@/lib/ia/limite-concorrencia";
import {
  auditarPeca,
  TAMANHO_MAXIMO_PECA_AUDITORIA,
  TIPOS_ARQUIVO_AUDITORIA_PECA,
  type TipoArquivoAuditoriaPeca,
} from "@/lib/auditoria-peca/auditar";
import type { AuditoriaPeca } from "@/lib/types";

/** Mesmo teto de `app/app/documentos/actions.ts` (Fase 3/4, análise estruturada por IA). */
const MAX_TAMANHO_ARQUIVO_AUDITORIA = 15 * 1024 * 1024;

/**
 * Piso mínimo de caracteres para a peça colada (revisão de segurança/QA/
 * techlead, Fase 4): evita gastar uma chamada de IA (e uma unidade de
 * `uso_ia`) numa entrada sem substância suficiente para uma auditoria útil
 * (ex.: "teste", um trecho isolado de uma linha). Rejeitado ANTES de criar o
 * registro em `auditorias_peca` ou chamar a IA.
 */
const TAMANHO_MINIMO_PECA_AUDITORIA = 200;

const EXTENSOES_POR_TIPO_AUDITORIA: Record<string, string[]> = {
  pdf: [".pdf"],
  docx: [".docx"],
  imagem: [".jpg", ".jpeg", ".png", ".webp"],
};

const MIME_POR_TIPO_AUDITORIA: Record<string, string[]> = {
  pdf: ["application/pdf"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  imagem: ["image/jpeg", "image/png", "image/webp"],
};

/** Mesma tolerância MIME/extensão de `inferirTipoArquivoDocumento` (ADR 0011). */
function inferirTipoArquivoAuditoria(arquivo: File): TipoArquivoAuditoriaPeca | null {
  const nomeMinusculo = arquivo.name.toLowerCase();
  for (const tipo of TIPOS_ARQUIVO_AUDITORIA_PECA) {
    const extensoes = EXTENSOES_POR_TIPO_AUDITORIA[tipo] ?? [];
    const mimes = MIME_POR_TIPO_AUDITORIA[tipo] ?? [];
    if (mimes.includes(arquivo.type) || extensoes.some((ext) => nomeMinusculo.endsWith(ext))) {
      return tipo;
    }
  }
  return null;
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Confirma que a ficha existe e é visível ao usuário logado (RLS de
 * `fichas_caso` já restringe ao escritório atual) — mesmo guard já duplicado
 * em `app/app/documentos/actions.ts` (sem módulo compartilhado ainda para
 * esse helper específico).
 */
async function fichaExisteEVisivel(supabase: SupabaseServerClient, fichaCasoId: string): Promise<boolean> {
  const { data, error } = await supabase.from("fichas_caso").select("id").eq("id", fichaCasoId).maybeSingle();
  if (error) {
    console.error("[auditor/actions/fichaExisteEVisivel] Falha ao verificar ficha:", error, { fichaCasoId });
    return false;
  }
  return data !== null;
}

/** Lê e valida `fichaCasoId` opcional de um `FormData` — string vazia/ausente vira `null`. */
async function resolverFichaCasoIdOpcional(
  supabase: SupabaseServerClient,
  formData: FormData,
): Promise<{ ok: true; fichaCasoId: string | null } | { ok: false; error: string }> {
  const bruto = formData.get("fichaCasoId");
  if (typeof bruto !== "string" || !bruto.trim()) return { ok: true, fichaCasoId: null };

  const parsed = z.string().uuid().safeParse(bruto.trim());
  if (!parsed.success) return { ok: false, error: "Ficha inválida." };

  if (!(await fichaExisteEVisivel(supabase, parsed.data))) {
    return { ok: false, error: "Ficha não encontrada." };
  }
  return { ok: true, fichaCasoId: parsed.data };
}

/** Lê e normaliza `titulo` opcional de um `FormData` — string vazia/ausente vira `null`. */
function resolverTituloOpcional(formData: FormData): string | null {
  const bruto = formData.get("titulo");
  return typeof bruto === "string" && bruto.trim() ? bruto.trim() : null;
}

export type AuditarPecaResultado = { ok: false; error: string };

/**
 * Auditoria de peça colada por texto direto no formulário (feature Pro
 * "auditoria_peca", ADR 0012). Gate de plano ANTES de qualquer I/O — mesmo
 * padrão de `analisarDocumentoAction`/`analisarContratoAction`. A linha em
 * `auditorias_peca` é criada com `status: "processando"` ANTES da chamada de
 * IA. Em sucesso, redireciona para a página de resultado
 * (`/app/auditor/[id]`) — nunca retorna no caminho feliz.
 */
export async function auditarPecaColadaAction(formData: FormData): Promise<AuditarPecaResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  if (!planoTemAcesso(usuario.perfil.escritorio, "auditoria_peca")) {
    return { ok: false, error: "Auditor de Peças é um recurso do plano Pro." };
  }

  const textoBruto = formData.get("texto");
  const texto = typeof textoBruto === "string" ? textoBruto.trim() : "";
  if (!texto) {
    return { ok: false, error: "Cole o texto da peça antes de auditar." };
  }
  if (texto.length < TAMANHO_MINIMO_PECA_AUDITORIA) {
    return { ok: false, error: "Texto muito curto para uma auditoria útil — cole a peça completa." };
  }
  if (texto.length > TAMANHO_MAXIMO_PECA_AUDITORIA) {
    return {
      ok: false,
      error: `A peça tem ${texto.length} caracteres — o limite atual é ${TAMANHO_MAXIMO_PECA_AUDITORIA}. Audite a peça em partes ou envie por upload.`,
    };
  }

  const titulo = resolverTituloOpcional(formData);
  const supabase = await createClient();
  const fichaResolvida = await resolverFichaCasoIdOpcional(supabase, formData);
  if (!fichaResolvida.ok) return { ok: false, error: fichaResolvida.error };
  const { fichaCasoId } = fichaResolvida;

  const { escritorio_id: escritorioId, id: perfilId } = usuario.perfil;

  if (await existeProcessamentoIaEmAndamento(escritorioId)) {
    return { ok: false, error: MENSAGEM_PROCESSAMENTO_IA_EM_ANDAMENTO };
  }

  const { data: registro, error: erroInsert } = await supabase
    .from("auditorias_peca")
    .insert({
      escritorio_id: escritorioId,
      ficha_caso_id: fichaCasoId,
      origem: "colado",
      titulo,
      texto_peca_analisado: texto,
      status: "processando",
      criado_por: perfilId,
    })
    .select("*")
    .single<AuditoriaPeca>();

  if (erroInsert || !registro) {
    console.error("[auditor/actions/auditarPecaColadaAction] Falha ao registrar auditoria:", erroInsert);
    return { ok: false, error: "Não foi possível registrar a auditoria. Tente novamente." };
  }

  const resultado = await auditarPeca({ origem: "colado", titulo, texto });
  const agora = new Date().toISOString();

  if (!resultado.ok) {
    await supabase
      .from("auditorias_peca")
      .update({ status: "erro", erro: resultado.erro, processado_em: agora })
      .eq("id", registro.id);

    revalidatePath("/app/auditor");
    if (fichaCasoId) revalidatePath(`/app/fichas/${fichaCasoId}`);
    return { ok: false, error: resultado.erro };
  }

  const { data: atualizado, error: erroUpdate } = await supabase
    .from("auditorias_peca")
    .update({
      status: "pronto",
      resultado_auditoria: resultado.resultado,
      modelo_ia_usado: resultado.modeloIaUsado,
      processado_em: agora,
    })
    .eq("id", registro.id)
    .select("*")
    .single<AuditoriaPeca>();

  if (erroUpdate || !atualizado) {
    console.error(
      "[auditor/actions/auditarPecaColadaAction] IA respondeu, mas falhou ao salvar o resultado:",
      erroUpdate,
      { auditoriaId: registro.id },
    );
    return { ok: false, error: "A IA auditou a peça, mas houve um erro ao salvar o resultado. Tente novamente." };
  }

  // Mesmo padrão de `analisarDocumentoAction`/`analisarContratoAction`: uma
  // linha por chamada de IA em `uso_ia` (contagem de chamadas, não de tokens).
  await supabase.from("uso_ia").insert({ escritorio_id: escritorioId, mes_ref: agora.slice(0, 7) });

  revalidatePath("/app/auditor");
  if (fichaCasoId) revalidatePath(`/app/fichas/${fichaCasoId}`);
  redirect(`/app/auditor/${atualizado.id}`);
}

/**
 * Auditoria de peça enviada por upload de arquivo (PDF, DOCX ou imagem) —
 * mesma feature Pro "auditoria_peca", espelhando exatamente o padrão de
 * `analisarDocumentoAction` (ADR 0011): gate de plano, validação de
 * tamanho/formato, linha `status: "processando"` criada ANTES da extração +
 * chamada de IA, redirect para o resultado no caminho feliz.
 */
export async function auditarPecaUploadAction(formData: FormData): Promise<AuditarPecaResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  if (!planoTemAcesso(usuario.perfil.escritorio, "auditoria_peca")) {
    return { ok: false, error: "Auditor de Peças é um recurso do plano Pro." };
  }

  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ok: false, error: "Selecione um arquivo (PDF, DOCX ou imagem)." };
  }
  if (arquivo.size > MAX_TAMANHO_ARQUIVO_AUDITORIA) {
    return { ok: false, error: "Arquivo muito grande (limite de 15MB)." };
  }

  const tipoArquivo = inferirTipoArquivoAuditoria(arquivo);
  if (!tipoArquivo) {
    return { ok: false, error: "Formato não suportado. Envie um PDF, DOCX ou imagem (jpg/png/webp)." };
  }

  const titulo = resolverTituloOpcional(formData);
  const supabase = await createClient();
  const fichaResolvida = await resolverFichaCasoIdOpcional(supabase, formData);
  if (!fichaResolvida.ok) return { ok: false, error: fichaResolvida.error };
  const { fichaCasoId } = fichaResolvida;

  const { escritorio_id: escritorioId, id: perfilId } = usuario.perfil;

  if (await existeProcessamentoIaEmAndamento(escritorioId)) {
    return { ok: false, error: MENSAGEM_PROCESSAMENTO_IA_EM_ANDAMENTO };
  }

  const { data: registro, error: erroInsert } = await supabase
    .from("auditorias_peca")
    .insert({
      escritorio_id: escritorioId,
      ficha_caso_id: fichaCasoId,
      origem: "upload",
      titulo,
      nome_arquivo: arquivo.name,
      tipo_arquivo: tipoArquivo,
      tamanho_bytes: arquivo.size,
      status: "processando",
      criado_por: perfilId,
    })
    .select("*")
    .single<AuditoriaPeca>();

  if (erroInsert || !registro) {
    console.error("[auditor/actions/auditarPecaUploadAction] Falha ao registrar auditoria:", erroInsert);
    return { ok: false, error: "Não foi possível registrar a auditoria. Tente novamente." };
  }

  const buffer = Buffer.from(await arquivo.arrayBuffer());
  const resultado = await auditarPeca({ origem: "upload", titulo, buffer, tipoArquivo, nomeArquivo: arquivo.name });
  const agora = new Date().toISOString();

  if (!resultado.ok) {
    await supabase
      .from("auditorias_peca")
      .update({ status: "erro", erro: resultado.erro, processado_em: agora })
      .eq("id", registro.id);

    revalidatePath("/app/auditor");
    if (fichaCasoId) revalidatePath(`/app/fichas/${fichaCasoId}`);
    return { ok: false, error: resultado.erro };
  }

  const { data: atualizado, error: erroUpdate } = await supabase
    .from("auditorias_peca")
    .update({
      status: "pronto",
      resultado_auditoria: resultado.resultado,
      modelo_ia_usado: resultado.modeloIaUsado,
      processado_em: agora,
    })
    .eq("id", registro.id)
    .select("*")
    .single<AuditoriaPeca>();

  if (erroUpdate || !atualizado) {
    console.error(
      "[auditor/actions/auditarPecaUploadAction] IA respondeu, mas falhou ao salvar o resultado:",
      erroUpdate,
      { auditoriaId: registro.id },
    );
    return { ok: false, error: "A IA auditou a peça, mas houve um erro ao salvar o resultado. Tente novamente." };
  }

  await supabase.from("uso_ia").insert({ escritorio_id: escritorioId, mes_ref: agora.slice(0, 7) });

  revalidatePath("/app/auditor");
  if (fichaCasoId) revalidatePath(`/app/fichas/${fichaCasoId}`);
  redirect(`/app/auditor/${atualizado.id}`);
}

export type ListarAuditoriasPecaResultado =
  | { ok: true; auditorias: AuditoriaPeca[] }
  | { ok: false; error: string };

/** Lista as auditorias de peça do escritório atual, mais recentes primeiro. */
export async function listarAuditoriasPecaAction(): Promise<ListarAuditoriasPecaResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("auditorias_peca")
    .select("*")
    .order("criado_em", { ascending: false })
    .returns<AuditoriaPeca[]>();

  if (error) {
    console.error("[auditor/actions/listarAuditoriasPecaAction] Falha ao listar auditorias:", error);
    return { ok: false, error: "Não foi possível carregar as auditorias. Tente novamente." };
  }

  return { ok: true, auditorias: data ?? [] };
}

export type BuscarAuditoriaPecaResultado = { ok: true; auditoria: AuditoriaPeca } | { ok: false; error: string };

/** Busca uma auditoria individual por id (RLS já restringe ao escritório atual). */
export async function buscarAuditoriaPecaAction(auditoriaId: string): Promise<BuscarAuditoriaPecaResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const parsed = z.string().uuid().safeParse(auditoriaId);
  if (!parsed.success) return { ok: false, error: "Auditoria inválida." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("auditorias_peca")
    .select("*")
    .eq("id", parsed.data)
    .maybeSingle<AuditoriaPeca>();

  if (error || !data) {
    if (error) console.error("[auditor/actions/buscarAuditoriaPecaAction] Falha ao buscar auditoria:", error);
    return { ok: false, error: "Auditoria não encontrada." };
  }

  return { ok: true, auditoria: data };
}
