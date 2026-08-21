"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { planoTemAcesso } from "@/lib/planos/gating";
import {
  analisarDocumento,
  TIPOS_ARQUIVO_ANALISE_DOCUMENTO,
  type TipoArquivoAnaliseDocumento,
} from "@/lib/document-intelligence/analisar";
import {
  compararDocumentos,
  TIPOS_ARQUIVO_COMPARACAO_DOCUMENTO,
  type TipoArquivoComparacaoDocumento,
} from "@/lib/document-intelligence/comparar";
import type { AnaliseDocumento, ComparacaoDocumento } from "@/lib/types";
import { MAX_ARQUIVOS_LOTE_DOCUMENTO } from "./constantes";

/** Mesmo teto de `app/app/base-conhecimento/actions.ts` / Fase 2 (ADR 0011, seção 7). */
const MAX_TAMANHO_ARQUIVO_DOCUMENTO = 15 * 1024 * 1024;

const EXTENSOES_POR_TIPO_DOCUMENTO: Record<string, string[]> = {
  pdf: [".pdf"],
  docx: [".docx"],
  imagem: [".jpg", ".jpeg", ".png", ".webp"],
};

const MIME_POR_TIPO_DOCUMENTO: Record<string, string[]> = {
  pdf: ["application/pdf"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  imagem: ["image/jpeg", "image/png", "image/webp"],
};

/**
 * Decide o `tipo_arquivo` a partir do MIME type e/ou extensão do arquivo
 * enviado, restrito ao subconjunto de tipos permitido pelo caller (análise
 * individual/lote aceita os 3 tipos; comparação só pdf/docx — ver
 * `lib/document-intelligence/comparar.ts`). Mesma tolerância de
 * `inferirTipoArquivoAnaliseProcesso` (Fase 2). Devolve `null` quando o
 * arquivo não bate com nenhum tipo permitido.
 */
function inferirTipoArquivoDocumento<T extends string>(arquivo: File, tiposPermitidos: readonly T[]): T | null {
  const nomeMinusculo = arquivo.name.toLowerCase();
  for (const tipo of tiposPermitidos) {
    const extensoes = EXTENSOES_POR_TIPO_DOCUMENTO[tipo] ?? [];
    const mimes = MIME_POR_TIPO_DOCUMENTO[tipo] ?? [];
    if (mimes.includes(arquivo.type) || extensoes.some((ext) => nomeMinusculo.endsWith(ext))) {
      return tipo;
    }
  }
  return null;
}

/** Melhor palpite de `tipo_arquivo` só para satisfazer o `check` da coluna em
 * linhas de lote que já nasceram inválidas (formato não suportado) — a linha
 * é marcada `status: "erro"` de qualquer forma, então o valor aqui é só
 * metadado aproximado, nunca usado para decidir o caminho de extração. */
function inferirTipoArquivoAproximado(arquivo: File): TipoArquivoAnaliseDocumento {
  return inferirTipoArquivoDocumento(arquivo, TIPOS_ARQUIVO_ANALISE_DOCUMENTO) ?? "pdf";
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Confirma que a ficha existe e é visível ao usuário logado (RLS de
 * `fichas_caso` já restringe ao escritório atual) — mesmo guard já duplicado
 * em `app/app/fichas/[id]/analise-processo-actions.ts` (sem módulo
 * compartilhado ainda para esse helper específico).
 */
async function fichaExisteEVisivel(supabase: SupabaseServerClient, fichaCasoId: string): Promise<boolean> {
  const { data, error } = await supabase.from("fichas_caso").select("id").eq("id", fichaCasoId).maybeSingle();
  if (error) {
    console.error("[documentos/actions/fichaExisteEVisivel] Falha ao verificar ficha:", error, { fichaCasoId });
    return false;
  }
  return data !== null;
}

/**
 * Confirma que uma análise individual já existente é visível ao usuário
 * logado (RLS de `analises_documento` já restringe ao escritório atual) —
 * usado para validar `analiseDocumentoAId`/`analiseDocumentoBId` antes de
 * gravar o vínculo em `comparacoes_documento`. Sem essa checagem, o `insert`
 * aceitaria qualquer UUID existente na tabela (a FK só valida existência, não
 * propriedade), vazando referência entre escritórios.
 */
async function analiseDocumentoExisteEVisivel(supabase: SupabaseServerClient, analiseId: string): Promise<boolean> {
  const { data, error } = await supabase.from("analises_documento").select("id").eq("id", analiseId).maybeSingle();
  if (error) {
    console.error("[documentos/actions/analiseDocumentoExisteEVisivel] Falha ao verificar análise:", error, {
      analiseId,
    });
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

export type AnalisarDocumentoResultado = { ok: false; error: string };

/**
 * Upload + análise individual de documento avulso (feature Pro
 * "analise_documento", ADR 0011). Gate de plano ANTES de qualquer I/O de
 * arquivo/IA — mesmo padrão de `uploadEAnalisarProcessoAction` (Fase 2). A
 * linha em `analises_documento` é criada com `status: "processando"` ANTES da
 * chamada de IA. Em sucesso, redireciona para a página de resultado
 * (`/app/documentos/[id]`) — nunca retorna no caminho feliz.
 */
export async function analisarDocumentoAction(formData: FormData): Promise<AnalisarDocumentoResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  if (!planoTemAcesso(usuario.perfil.escritorio, "analise_documento")) {
    return { ok: false, error: "Análise de documento é um recurso do plano Pro." };
  }

  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ok: false, error: "Selecione um arquivo (PDF, DOCX ou imagem)." };
  }
  if (arquivo.size > MAX_TAMANHO_ARQUIVO_DOCUMENTO) {
    return { ok: false, error: "Arquivo muito grande (limite de 15MB)." };
  }

  const tipoArquivo = inferirTipoArquivoDocumento(arquivo, TIPOS_ARQUIVO_ANALISE_DOCUMENTO);
  if (!tipoArquivo) {
    return { ok: false, error: "Formato não suportado. Envie um PDF, DOCX ou imagem (jpg/png/webp)." };
  }

  const supabase = await createClient();
  const fichaResolvida = await resolverFichaCasoIdOpcional(supabase, formData);
  if (!fichaResolvida.ok) return { ok: false, error: fichaResolvida.error };
  const { fichaCasoId } = fichaResolvida;

  const { escritorio_id: escritorioId, id: perfilId } = usuario.perfil;

  const { data: registro, error: erroInsert } = await supabase
    .from("analises_documento")
    .insert({
      escritorio_id: escritorioId,
      ficha_caso_id: fichaCasoId,
      nome_arquivo: arquivo.name,
      tipo_arquivo: tipoArquivo,
      tamanho_bytes: arquivo.size,
      status: "processando",
      criado_por: perfilId,
    })
    .select("*")
    .single<AnaliseDocumento>();

  if (erroInsert || !registro) {
    console.error("[documentos/actions/analisarDocumentoAction] Falha ao registrar análise:", erroInsert);
    return { ok: false, error: "Não foi possível registrar a análise. Tente novamente." };
  }

  const buffer = Buffer.from(await arquivo.arrayBuffer());
  const resultado = await analisarDocumento({ buffer, tipoArquivo, nomeArquivo: arquivo.name });
  const agora = new Date().toISOString();

  if (!resultado.ok) {
    await supabase
      .from("analises_documento")
      .update({ status: "erro", erro: resultado.erro, processado_em: agora })
      .eq("id", registro.id);

    revalidatePath("/app/documentos");
    if (fichaCasoId) revalidatePath(`/app/fichas/${fichaCasoId}`);
    return { ok: false, error: resultado.erro };
  }

  const { data: atualizado, error: erroUpdate } = await supabase
    .from("analises_documento")
    .update({
      status: "pronto",
      resultado_analise: resultado.resultado,
      modelo_ia_usado: resultado.modeloIaUsado,
      processado_em: agora,
    })
    .eq("id", registro.id)
    .select("*")
    .single<AnaliseDocumento>();

  if (erroUpdate || !atualizado) {
    console.error(
      "[documentos/actions/analisarDocumentoAction] IA respondeu, mas falhou ao salvar o resultado:",
      erroUpdate,
      { analiseId: registro.id },
    );
    return { ok: false, error: "A IA analisou o documento, mas houve um erro ao salvar o resultado. Tente novamente." };
  }

  // Mesmo padrão de `analise-processo-actions.ts`/`redline/actions.ts`: uma
  // linha por chamada de IA em `uso_ia` (contagem de chamadas, não de tokens).
  await supabase.from("uso_ia").insert({ escritorio_id: escritorioId, mes_ref: agora.slice(0, 7) });

  revalidatePath("/app/documentos");
  if (fichaCasoId) revalidatePath(`/app/fichas/${fichaCasoId}`);
  redirect(`/app/documentos/${atualizado.id}`);
}

export type AnalisarDocumentosLoteResultado =
  | { ok: true; analises: AnaliseDocumento[] }
  | { ok: false; error: string };

/**
 * Upload + análise em lote de até `MAX_ARQUIVOS_LOTE_DOCUMENTO` documentos
 * avulsos (mesma feature Pro "analise_documento" — lote é a mesma operação
 * repetida N vezes, ver ADR 0011 seção 7). Cria as N linhas em
 * `analises_documento` com `status: "processando"` ANTES de qualquer chamada
 * de IA (mesmo padrão do upload individual), depois processa cada arquivo em
 * loop SEQUENCIAL (nunca `Promise.all` — evita estourar concorrência do pool
 * Gemini/Groq e o teto de `maxDuration` de forma imprevisível, ver ADR 0011
 * seção 8). Arquivos já inválidos (tamanho/formato) nascem como uma linha
 * `status: "erro"` sem consumir nenhuma chamada de IA — o lote nunca é
 * rejeitado inteiro por causa de um único arquivo ruim no meio.
 */
export async function analisarDocumentosLoteAction(formData: FormData): Promise<AnalisarDocumentosLoteResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  if (!planoTemAcesso(usuario.perfil.escritorio, "analise_documento")) {
    return { ok: false, error: "Análise de documento é um recurso do plano Pro." };
  }

  const arquivos = formData.getAll("arquivos").filter((item): item is File => item instanceof File && item.size > 0);
  if (arquivos.length === 0) {
    return { ok: false, error: "Selecione ao menos um arquivo." };
  }
  if (arquivos.length > MAX_ARQUIVOS_LOTE_DOCUMENTO) {
    return {
      ok: false,
      error: `Máximo de ${MAX_ARQUIVOS_LOTE_DOCUMENTO} arquivos por lote. Envie o restante em um novo lote.`,
    };
  }

  const supabase = await createClient();
  const fichaResolvida = await resolverFichaCasoIdOpcional(supabase, formData);
  if (!fichaResolvida.ok) return { ok: false, error: fichaResolvida.error };
  const { fichaCasoId } = fichaResolvida;

  const { escritorio_id: escritorioId, id: perfilId } = usuario.perfil;

  type ItemLote = { arquivo: File; tipoArquivo: TipoArquivoAnaliseDocumento | null; erroValidacao: string | null };
  const itens: ItemLote[] = arquivos.map((arquivo) => {
    if (arquivo.size > MAX_TAMANHO_ARQUIVO_DOCUMENTO) {
      return { arquivo, tipoArquivo: null, erroValidacao: "Arquivo muito grande (limite de 15MB)." };
    }
    const tipoArquivo = inferirTipoArquivoDocumento(arquivo, TIPOS_ARQUIVO_ANALISE_DOCUMENTO);
    if (!tipoArquivo) {
      return { arquivo, tipoArquivo: null, erroValidacao: "Formato não suportado (envie PDF, DOCX ou imagem)." };
    }
    return { arquivo, tipoArquivo, erroValidacao: null };
  });

  const { data: linhasCriadas, error: erroInsert } = await supabase
    .from("analises_documento")
    .insert(
      itens.map((item) => ({
        escritorio_id: escritorioId,
        ficha_caso_id: fichaCasoId,
        nome_arquivo: item.arquivo.name,
        tipo_arquivo: item.tipoArquivo ?? inferirTipoArquivoAproximado(item.arquivo),
        tamanho_bytes: item.arquivo.size,
        status: "processando" as const,
        criado_por: perfilId,
      })),
    )
    .select("*")
    .returns<AnaliseDocumento[]>();

  if (erroInsert || !linhasCriadas || linhasCriadas.length !== itens.length) {
    console.error("[documentos/actions/analisarDocumentosLoteAction] Falha ao registrar lote:", erroInsert);
    return { ok: false, error: "Não foi possível registrar os documentos do lote. Tente novamente." };
  }

  const analisesFinal: AnaliseDocumento[] = [];

  for (let i = 0; i < itens.length; i += 1) {
    const item = itens[i];
    const linha = linhasCriadas[i];
    if (!item || !linha) continue;

    if (item.erroValidacao) {
      const agora = new Date().toISOString();
      const { data: atualizada } = await supabase
        .from("analises_documento")
        .update({ status: "erro", erro: item.erroValidacao, processado_em: agora })
        .eq("id", linha.id)
        .select("*")
        .single<AnaliseDocumento>();
      analisesFinal.push(atualizada ?? { ...linha, status: "erro", erro: item.erroValidacao, processado_em: agora });
      continue;
    }

    const buffer = Buffer.from(await item.arquivo.arrayBuffer());
    const resultado = await analisarDocumento({
      buffer,
      tipoArquivo: item.tipoArquivo as TipoArquivoAnaliseDocumento,
      nomeArquivo: item.arquivo.name,
    });
    const agora = new Date().toISOString();

    if (!resultado.ok) {
      const { data: atualizada } = await supabase
        .from("analises_documento")
        .update({ status: "erro", erro: resultado.erro, processado_em: agora })
        .eq("id", linha.id)
        .select("*")
        .single<AnaliseDocumento>();
      analisesFinal.push(atualizada ?? { ...linha, status: "erro", erro: resultado.erro, processado_em: agora });
      continue;
    }

    const { data: atualizada, error: erroUpdate } = await supabase
      .from("analises_documento")
      .update({
        status: "pronto",
        resultado_analise: resultado.resultado,
        modelo_ia_usado: resultado.modeloIaUsado,
        processado_em: agora,
      })
      .eq("id", linha.id)
      .select("*")
      .single<AnaliseDocumento>();

    if (erroUpdate || !atualizada) {
      console.error(
        "[documentos/actions/analisarDocumentosLoteAction] IA respondeu, mas falhou ao salvar o resultado:",
        erroUpdate,
        { analiseId: linha.id },
      );
      const erroSalvar = "A IA analisou o documento, mas houve um erro ao salvar o resultado.";
      analisesFinal.push({ ...linha, status: "erro", erro: erroSalvar, processado_em: agora });
      continue;
    }

    await supabase.from("uso_ia").insert({ escritorio_id: escritorioId, mes_ref: agora.slice(0, 7) });
    analisesFinal.push(atualizada);
  }

  revalidatePath("/app/documentos");
  if (fichaCasoId) revalidatePath(`/app/fichas/${fichaCasoId}`);
  return { ok: true, analises: analisesFinal };
}

export type CompararDocumentosResultado =
  | { ok: true; comparacao: ComparacaoDocumento }
  | { ok: false; error: string };

/**
 * Comparação A x B (feature Pro "comparacao_documentos", chave separada de
 * "analise_documento" — ADR 0011 seção 7). Sempre exige upload dos DOIS
 * arquivos: como nenhum binário original é persistido (mesma decisão de
 * `lib/documentos/gerar-docx.ts`/`gerar-pdf.ts`, ver
 * `.agents/memoria/senior-engineer.md`), `analiseDocumentoAId`/
 * `analiseDocumentoBId` são só metadado de vínculo opcional (ex.: usuário
 * chegou aqui a partir de `/app/documentos/[id]`), nunca uma fonte de bytes.
 */
export async function compararDocumentosAction(formData: FormData): Promise<CompararDocumentosResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  if (!planoTemAcesso(usuario.perfil.escritorio, "comparacao_documentos")) {
    return { ok: false, error: "Comparação de documentos é um recurso do plano Pro." };
  }

  const arquivoA = formData.get("arquivoA");
  const arquivoB = formData.get("arquivoB");
  if (!(arquivoA instanceof File) || arquivoA.size === 0) {
    return { ok: false, error: "Selecione o Documento A (PDF ou DOCX)." };
  }
  if (!(arquivoB instanceof File) || arquivoB.size === 0) {
    return { ok: false, error: "Selecione o Documento B (PDF ou DOCX)." };
  }
  if (arquivoA.size > MAX_TAMANHO_ARQUIVO_DOCUMENTO) {
    return { ok: false, error: "Documento A muito grande (limite de 15MB)." };
  }
  if (arquivoB.size > MAX_TAMANHO_ARQUIVO_DOCUMENTO) {
    return { ok: false, error: "Documento B muito grande (limite de 15MB)." };
  }

  const tipoArquivoA = inferirTipoArquivoDocumento(arquivoA, TIPOS_ARQUIVO_COMPARACAO_DOCUMENTO);
  if (!tipoArquivoA) return { ok: false, error: "Formato do Documento A não suportado. Envie PDF ou DOCX." };
  const tipoArquivoB = inferirTipoArquivoDocumento(arquivoB, TIPOS_ARQUIVO_COMPARACAO_DOCUMENTO);
  if (!tipoArquivoB) return { ok: false, error: "Formato do Documento B não suportado. Envie PDF ou DOCX." };

  const supabase = await createClient();
  const fichaResolvida = await resolverFichaCasoIdOpcional(supabase, formData);
  if (!fichaResolvida.ok) return { ok: false, error: fichaResolvida.error };
  const { fichaCasoId } = fichaResolvida;

  const analiseDocumentoAId = await resolverAnaliseDocumentoIdOpcional(supabase, formData, "analiseDocumentoAId");
  if (!analiseDocumentoAId.ok) return { ok: false, error: analiseDocumentoAId.error };
  const analiseDocumentoBId = await resolverAnaliseDocumentoIdOpcional(supabase, formData, "analiseDocumentoBId");
  if (!analiseDocumentoBId.ok) return { ok: false, error: analiseDocumentoBId.error };

  const { escritorio_id: escritorioId, id: perfilId } = usuario.perfil;

  const { data: registro, error: erroInsert } = await supabase
    .from("comparacoes_documento")
    .insert({
      escritorio_id: escritorioId,
      ficha_caso_id: fichaCasoId,
      nome_arquivo_a: arquivoA.name,
      nome_arquivo_b: arquivoB.name,
      analise_documento_a_id: analiseDocumentoAId.id,
      analise_documento_b_id: analiseDocumentoBId.id,
      status: "processando",
      criado_por: perfilId,
    })
    .select("*")
    .single<ComparacaoDocumento>();

  if (erroInsert || !registro) {
    console.error("[documentos/actions/compararDocumentosAction] Falha ao registrar comparação:", erroInsert);
    return { ok: false, error: "Não foi possível registrar a comparação. Tente novamente." };
  }

  const bufferA = Buffer.from(await arquivoA.arrayBuffer());
  const bufferB = Buffer.from(await arquivoB.arrayBuffer());

  const resultado = await compararDocumentos({
    bufferA,
    tipoArquivoA: tipoArquivoA as TipoArquivoComparacaoDocumento,
    nomeArquivoA: arquivoA.name,
    bufferB,
    tipoArquivoB: tipoArquivoB as TipoArquivoComparacaoDocumento,
    nomeArquivoB: arquivoB.name,
  });
  const agora = new Date().toISOString();

  if (!resultado.ok) {
    await supabase
      .from("comparacoes_documento")
      .update({ status: "erro", erro: resultado.erro, processado_em: agora })
      .eq("id", registro.id);

    revalidatePath("/app/documentos");
    return { ok: false, error: resultado.erro };
  }

  const { data: atualizada, error: erroUpdate } = await supabase
    .from("comparacoes_documento")
    .update({
      status: "pronto",
      resultado_comparacao: resultado.resultado,
      modelo_ia_usado: resultado.modeloIaUsado,
      processado_em: agora,
    })
    .eq("id", registro.id)
    .select("*")
    .single<ComparacaoDocumento>();

  if (erroUpdate || !atualizada) {
    console.error(
      "[documentos/actions/compararDocumentosAction] IA respondeu, mas falhou ao salvar o resultado:",
      erroUpdate,
      { comparacaoId: registro.id },
    );
    return {
      ok: false,
      error: "A IA comparou os documentos, mas houve um erro ao salvar o resultado. Tente novamente.",
    };
  }

  await supabase.from("uso_ia").insert({ escritorio_id: escritorioId, mes_ref: agora.slice(0, 7) });

  revalidatePath("/app/documentos");
  return { ok: true, comparacao: atualizada };
}

/** Lê e valida um campo de vínculo opcional (`analiseDocumentoAId`/`analiseDocumentoBId`). */
async function resolverAnaliseDocumentoIdOpcional(
  supabase: SupabaseServerClient,
  formData: FormData,
  campo: "analiseDocumentoAId" | "analiseDocumentoBId",
): Promise<{ ok: true; id: string | null } | { ok: false; error: string }> {
  const bruto = formData.get(campo);
  if (typeof bruto !== "string" || !bruto.trim()) return { ok: true, id: null };

  const parsed = z.string().uuid().safeParse(bruto.trim());
  if (!parsed.success) return { ok: true, id: null };

  if (!(await analiseDocumentoExisteEVisivel(supabase, parsed.data))) {
    return { ok: true, id: null };
  }
  return { ok: true, id: parsed.data };
}

export type ListarAnalisesDocumentoResultado =
  | { ok: true; analises: AnaliseDocumento[] }
  | { ok: false; error: string };

/** Lista as análises de documento do escritório atual, mais recentes primeiro. */
export async function listarAnalisesDocumentoAction(): Promise<ListarAnalisesDocumentoResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("analises_documento")
    .select("*")
    .order("criado_em", { ascending: false })
    .returns<AnaliseDocumento[]>();

  if (error) {
    console.error("[documentos/actions/listarAnalisesDocumentoAction] Falha ao listar análises:", error);
    return { ok: false, error: "Não foi possível carregar as análises de documento. Tente novamente." };
  }

  return { ok: true, analises: data ?? [] };
}

export type BuscarAnaliseDocumentoResultado =
  | { ok: true; analise: AnaliseDocumento }
  | { ok: false; error: string };

/** Busca uma análise individual por id (RLS já restringe ao escritório atual). */
export async function buscarAnaliseDocumentoAction(analiseId: string): Promise<BuscarAnaliseDocumentoResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const parsed = z.string().uuid().safeParse(analiseId);
  if (!parsed.success) return { ok: false, error: "Análise inválida." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("analises_documento")
    .select("*")
    .eq("id", parsed.data)
    .maybeSingle<AnaliseDocumento>();

  if (error || !data) {
    if (error) console.error("[documentos/actions/buscarAnaliseDocumentoAction] Falha ao buscar análise:", error);
    return { ok: false, error: "Análise não encontrada." };
  }

  return { ok: true, analise: data };
}
