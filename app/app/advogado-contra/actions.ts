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
  analisarComoAdvogadoContra,
  TAMANHO_MAXIMO_TESE_ADVOGADO_CONTRA,
  TIPOS_ARQUIVO_ADVOGADO_CONTRA,
} from "@/lib/advogado-contra/analisar";
import {
  bufferBateComAssinatura,
  inferirTipoArquivoUpload,
  MENSAGEM_ARQUIVO_NAO_BATE_COM_TIPO,
} from "@/lib/uploads/validacao";
import type { AnaliseAdvogadoContra, TeseCaso } from "@/lib/types";

/** Mesmo teto de `app/app/auditor/actions.ts` (Fase 4) — 15MB de upload. */
const MAX_TAMANHO_ARQUIVO_ADVOGADO_CONTRA = 15 * 1024 * 1024;

/**
 * Piso mínimo de caracteres para a tese/peça colada — mesmo racional de
 * `TAMANHO_MINIMO_PECA_AUDITORIA` (Fase 4): evita gastar uma chamada de IA
 * (e uma unidade de `uso_ia`) numa entrada sem substância suficiente para uma
 * análise adversarial útil. Rejeitado ANTES de criar o registro em
 * `analises_advogado_contra` ou chamar a IA. O modo `tese_cadastrada` não
 * passa por esse piso: `teses_caso.tese` já vem validada pela Fase 1.
 */
const TAMANHO_MINIMO_TESE_ADVOGADO_CONTRA = 100;

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Confirma que a ficha existe e é visível ao usuário logado (RLS de
 * `fichas_caso` já restringe ao escritório atual) — mesmo guard duplicado em
 * `app/app/auditor/actions.ts`/`app/app/documentos/actions.ts`.
 */
async function fichaExisteEVisivel(supabase: SupabaseServerClient, fichaCasoId: string): Promise<boolean> {
  const { data, error } = await supabase.from("fichas_caso").select("id").eq("id", fichaCasoId).maybeSingle();
  if (error) {
    console.error("[advogado-contra/actions/fichaExisteEVisivel] Falha ao verificar ficha:", error, { fichaCasoId });
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

export type AnalisarAdvogadoContraResultado = { ok: false; error: string };

/**
 * Análise adversarial de tese/peça colada por texto direto no formulário
 * (feature Pro "advogado_do_contra", ADR 0013). Gate de plano ANTES de
 * qualquer I/O — mesmo padrão de `auditarPecaColadaAction`. A linha em
 * `analises_advogado_contra` é criada com `status: "processando"` ANTES da
 * chamada de IA. Em sucesso, redireciona para a página de resultado
 * (`/app/advogado-contra/[id]`) — nunca retorna no caminho feliz.
 */
export async function analisarColadoAction(formData: FormData): Promise<AnalisarAdvogadoContraResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  if (!planoTemAcesso(usuario.perfil.escritorio, "advogado_do_contra")) {
    return { ok: false, error: "Advogado do Contra é um recurso do plano Pro." };
  }

  const textoBruto = formData.get("texto");
  const texto = typeof textoBruto === "string" ? textoBruto.trim() : "";
  if (!texto) {
    return { ok: false, error: "Cole o texto da tese ou peça antes de analisar." };
  }
  if (texto.length < TAMANHO_MINIMO_TESE_ADVOGADO_CONTRA) {
    return { ok: false, error: "Texto muito curto para uma análise adversarial útil — descreva a tese com mais detalhe." };
  }
  if (texto.length > TAMANHO_MAXIMO_TESE_ADVOGADO_CONTRA) {
    return {
      ok: false,
      error: `O texto tem ${texto.length} caracteres — o limite atual é ${TAMANHO_MAXIMO_TESE_ADVOGADO_CONTRA}. Analise em partes ou envie por upload.`,
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
    .from("analises_advogado_contra")
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
    .single<AnaliseAdvogadoContra>();

  if (erroInsert || !registro) {
    console.error("[advogado-contra/actions/analisarColadoAction] Falha ao registrar análise:", erroInsert);
    return { ok: false, error: "Não foi possível registrar a análise. Tente novamente." };
  }

  const resultado = await analisarComoAdvogadoContra({ origem: "colado", titulo, texto });
  const agora = new Date().toISOString();

  if (!resultado.ok) {
    await supabase
      .from("analises_advogado_contra")
      .update({ status: "erro", erro: resultado.erro, processado_em: agora })
      .eq("id", registro.id);

    revalidatePath("/app/advogado-contra");
    if (fichaCasoId) revalidatePath(`/app/fichas/${fichaCasoId}`);
    return { ok: false, error: resultado.erro };
  }

  const { data: atualizado, error: erroUpdate } = await supabase
    .from("analises_advogado_contra")
    .update({
      status: "pronto",
      resultado_advogado_contra: resultado.resultado,
      modelo_ia_usado: resultado.modeloIaUsado,
      processado_em: agora,
    })
    .eq("id", registro.id)
    .select("*")
    .single<AnaliseAdvogadoContra>();

  if (erroUpdate || !atualizado) {
    console.error(
      "[advogado-contra/actions/analisarColadoAction] IA respondeu, mas falhou ao salvar o resultado:",
      erroUpdate,
      { analiseId: registro.id },
    );
    return { ok: false, error: "A IA analisou a tese, mas houve um erro ao salvar o resultado. Tente novamente." };
  }

  // Mesmo padrão de `auditarPecaColadaAction`: uma linha por chamada de IA
  // em `uso_ia` (contagem de chamadas, não de tokens).
  await supabase.from("uso_ia").insert({ escritorio_id: escritorioId, mes_ref: agora.slice(0, 7) });

  revalidatePath("/app/advogado-contra");
  if (fichaCasoId) revalidatePath(`/app/fichas/${fichaCasoId}`);
  redirect(`/app/advogado-contra/${atualizado.id}`);
}

/**
 * Análise adversarial de tese/peça enviada por upload de arquivo (PDF, DOCX
 * ou imagem) — mesma feature Pro "advogado_do_contra", espelhando exatamente
 * o padrão de `auditarPecaUploadAction` (ADR 0012): gate de plano, validação
 * de tamanho/formato, linha `status: "processando"` criada ANTES da extração
 * + chamada de IA, redirect para o resultado no caminho feliz.
 */
export async function analisarUploadAction(formData: FormData): Promise<AnalisarAdvogadoContraResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  if (!planoTemAcesso(usuario.perfil.escritorio, "advogado_do_contra")) {
    return { ok: false, error: "Advogado do Contra é um recurso do plano Pro." };
  }

  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ok: false, error: "Selecione um arquivo (PDF, DOCX ou imagem)." };
  }
  if (arquivo.size > MAX_TAMANHO_ARQUIVO_ADVOGADO_CONTRA) {
    return { ok: false, error: "Arquivo muito grande (limite de 15MB)." };
  }

  const tipoArquivo = inferirTipoArquivoUpload(arquivo, TIPOS_ARQUIVO_ADVOGADO_CONTRA);
  if (!tipoArquivo) {
    return { ok: false, error: "Formato não suportado. Envie um PDF, DOCX ou imagem (jpg/png/webp)." };
  }

  const buffer = Buffer.from(await arquivo.arrayBuffer());
  if (!bufferBateComAssinatura(buffer, tipoArquivo)) {
    return { ok: false, error: MENSAGEM_ARQUIVO_NAO_BATE_COM_TIPO };
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
    .from("analises_advogado_contra")
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
    .single<AnaliseAdvogadoContra>();

  if (erroInsert || !registro) {
    console.error("[advogado-contra/actions/analisarUploadAction] Falha ao registrar análise:", erroInsert);
    return { ok: false, error: "Não foi possível registrar a análise. Tente novamente." };
  }

  const resultado = await analisarComoAdvogadoContra({
    origem: "upload",
    titulo,
    buffer,
    tipoArquivo,
    nomeArquivo: arquivo.name,
  });
  const agora = new Date().toISOString();

  if (!resultado.ok) {
    await supabase
      .from("analises_advogado_contra")
      .update({ status: "erro", erro: resultado.erro, processado_em: agora })
      .eq("id", registro.id);

    revalidatePath("/app/advogado-contra");
    if (fichaCasoId) revalidatePath(`/app/fichas/${fichaCasoId}`);
    return { ok: false, error: resultado.erro };
  }

  const { data: atualizado, error: erroUpdate } = await supabase
    .from("analises_advogado_contra")
    .update({
      status: "pronto",
      resultado_advogado_contra: resultado.resultado,
      modelo_ia_usado: resultado.modeloIaUsado,
      processado_em: agora,
    })
    .eq("id", registro.id)
    .select("*")
    .single<AnaliseAdvogadoContra>();

  if (erroUpdate || !atualizado) {
    console.error(
      "[advogado-contra/actions/analisarUploadAction] IA respondeu, mas falhou ao salvar o resultado:",
      erroUpdate,
      { analiseId: registro.id },
    );
    return { ok: false, error: "A IA analisou a tese, mas houve um erro ao salvar o resultado. Tente novamente." };
  }

  await supabase.from("uso_ia").insert({ escritorio_id: escritorioId, mes_ref: agora.slice(0, 7) });

  revalidatePath("/app/advogado-contra");
  if (fichaCasoId) revalidatePath(`/app/fichas/${fichaCasoId}`);
  redirect(`/app/advogado-contra/${atualizado.id}`);
}

/**
 * Análise adversarial de uma tese JÁ CADASTRADA em `teses_caso` (Fase 1,
 * modo NOVO em relação ao Auditor de Peças, ADR 0013). Diferente dos outros
 * dois modos, `ficha_caso_id` NUNCA é um parâmetro separado aqui: toda tese
 * pertence a uma ficha (`teses_caso.ficha_caso_id` não é nulo), então o
 * vínculo vem automaticamente da própria tese buscada — reduz a superfície
 * de erro (nunca há risco de vincular a análise a uma ficha diferente da
 * dona da tese).
 */
export async function analisarTeseCadastradaAction(teseCasoId: string): Promise<AnalisarAdvogadoContraResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  if (!planoTemAcesso(usuario.perfil.escritorio, "advogado_do_contra")) {
    return { ok: false, error: "Advogado do Contra é um recurso do plano Pro." };
  }

  const parsedTeseId = z.string().uuid().safeParse(teseCasoId);
  if (!parsedTeseId.success) return { ok: false, error: "Tese inválida." };

  const supabase = await createClient();

  // Mesmo padrão de `fichaExisteEVisivel`: um SELECT explícito antes de
  // qualquer efeito colateral, mesmo a RLS de `teses_caso` já isolando por
  // escritório — devolve um erro tratável em vez de deixar o banco rejeitar
  // silenciosamente mais adiante.
  const { data: tese, error: erroTese } = await supabase
    .from("teses_caso")
    .select("*")
    .eq("id", parsedTeseId.data)
    .maybeSingle<TeseCaso>();

  if (erroTese || !tese) {
    if (erroTese) console.error("[advogado-contra/actions/analisarTeseCadastradaAction] Falha ao buscar tese:", erroTese);
    return { ok: false, error: "Tese não encontrada." };
  }

  const { escritorio_id: escritorioId, id: perfilId } = usuario.perfil;

  if (await existeProcessamentoIaEmAndamento(escritorioId)) {
    return { ok: false, error: MENSAGEM_PROCESSAMENTO_IA_EM_ANDAMENTO };
  }

  const { data: registro, error: erroInsert } = await supabase
    .from("analises_advogado_contra")
    .insert({
      escritorio_id: escritorioId,
      ficha_caso_id: tese.ficha_caso_id,
      tese_caso_id: tese.id,
      origem: "tese_cadastrada",
      titulo: null,
      status: "processando",
      criado_por: perfilId,
    })
    .select("*")
    .single<AnaliseAdvogadoContra>();

  if (erroInsert || !registro) {
    console.error("[advogado-contra/actions/analisarTeseCadastradaAction] Falha ao registrar análise:", erroInsert);
    return { ok: false, error: "Não foi possível registrar a análise. Tente novamente." };
  }

  const resultado = await analisarComoAdvogadoContra({
    origem: "tese_cadastrada",
    tese: tese.tese,
    fundamentacao: tese.fundamentacao,
  });
  const agora = new Date().toISOString();

  if (!resultado.ok) {
    await supabase
      .from("analises_advogado_contra")
      .update({ status: "erro", erro: resultado.erro, processado_em: agora })
      .eq("id", registro.id);

    revalidatePath("/app/advogado-contra");
    revalidatePath(`/app/fichas/${tese.ficha_caso_id}`);
    return { ok: false, error: resultado.erro };
  }

  const { data: atualizado, error: erroUpdate } = await supabase
    .from("analises_advogado_contra")
    .update({
      status: "pronto",
      resultado_advogado_contra: resultado.resultado,
      modelo_ia_usado: resultado.modeloIaUsado,
      processado_em: agora,
    })
    .eq("id", registro.id)
    .select("*")
    .single<AnaliseAdvogadoContra>();

  if (erroUpdate || !atualizado) {
    console.error(
      "[advogado-contra/actions/analisarTeseCadastradaAction] IA respondeu, mas falhou ao salvar o resultado:",
      erroUpdate,
      { analiseId: registro.id },
    );
    return { ok: false, error: "A IA analisou a tese, mas houve um erro ao salvar o resultado. Tente novamente." };
  }

  await supabase.from("uso_ia").insert({ escritorio_id: escritorioId, mes_ref: agora.slice(0, 7) });

  revalidatePath("/app/advogado-contra");
  revalidatePath(`/app/fichas/${tese.ficha_caso_id}`);
  redirect(`/app/advogado-contra/${atualizado.id}`);
}

export type ListarAnalisesAdvogadoContraResultado =
  | { ok: true; analises: AnaliseAdvogadoContra[] }
  | { ok: false; error: string };

/** Lista as análises do Advogado do Contra do escritório atual, mais recentes primeiro. */
export async function listarAnalisesAdvogadoContraAction(): Promise<ListarAnalisesAdvogadoContraResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("analises_advogado_contra")
    .select("*")
    .order("criado_em", { ascending: false })
    .returns<AnaliseAdvogadoContra[]>();

  if (error) {
    console.error("[advogado-contra/actions/listarAnalisesAdvogadoContraAction] Falha ao listar análises:", error);
    return { ok: false, error: "Não foi possível carregar as análises. Tente novamente." };
  }

  return { ok: true, analises: data ?? [] };
}

export type BuscarAnaliseAdvogadoContraResultado =
  | { ok: true; analise: AnaliseAdvogadoContra }
  | { ok: false; error: string };

/** Busca uma análise individual por id (RLS já restringe ao escritório atual). */
export async function buscarAnaliseAdvogadoContraAction(
  analiseId: string,
): Promise<BuscarAnaliseAdvogadoContraResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const parsed = z.string().uuid().safeParse(analiseId);
  if (!parsed.success) return { ok: false, error: "Análise inválida." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("analises_advogado_contra")
    .select("*")
    .eq("id", parsed.data)
    .maybeSingle<AnaliseAdvogadoContra>();

  if (error || !data) {
    if (error) console.error("[advogado-contra/actions/buscarAnaliseAdvogadoContraAction] Falha ao buscar análise:", error);
    return { ok: false, error: "Análise não encontrada." };
  }

  return { ok: true, analise: data };
}

export type TeseParaSelecaoAdvogadoContra = Pick<TeseCaso, "id" | "tese" | "ficha_caso_id" | "status" | "criado_em"> & {
  nomeCliente: string | null;
};

export type ListarTesesParaAdvogadoContraResultado =
  | { ok: true; teses: TeseParaSelecaoAdvogadoContra[] }
  | { ok: false; error: string };

/**
 * Lista teses candidatas ao seletor do modo "tese cadastrada" — filtra por
 * `fichaCasoId` quando informado (fluxo do atalho `?fichaId=` vindo de
 * `/app/fichas/[id]`), senão lista as mais recentes do escritório inteiro
 * (RLS de `teses_caso` já restringe ao escritório do usuário autenticado).
 * Teto de 50 teses no modo "sem filtro" — evita carregar um seletor gigante
 * quando o escritório acumular muitas teses ao longo do tempo; refinar com
 * busca textual é melhoria futura, fora do escopo desta Onda.
 */
export async function listarTesesParaAdvogadoContraAction(
  fichaCasoId?: string | null,
): Promise<ListarTesesParaAdvogadoContraResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  let query = supabase
    .from("teses_caso")
    .select("id, tese, ficha_caso_id, status, criado_em, fichas_caso(nome_cliente)")
    .order("criado_em", { ascending: false });

  if (fichaCasoId) {
    const parsed = z.string().uuid().safeParse(fichaCasoId);
    if (!parsed.success) return { ok: false, error: "Ficha inválida." };
    query = query.eq("ficha_caso_id", parsed.data);
  } else {
    query = query.limit(50);
  }

  const { data, error } = await query.returns<
    Array<Pick<TeseCaso, "id" | "tese" | "ficha_caso_id" | "status" | "criado_em"> & {
      fichas_caso: { nome_cliente: string | null } | null;
    }>
  >();

  if (error) {
    console.error("[advogado-contra/actions/listarTesesParaAdvogadoContraAction] Falha ao listar teses:", error);
    return { ok: false, error: "Não foi possível carregar as teses cadastradas. Tente novamente." };
  }

  const teses: TeseParaSelecaoAdvogadoContra[] = (data ?? []).map((item) => ({
    id: item.id,
    tese: item.tese,
    ficha_caso_id: item.ficha_caso_id,
    status: item.status,
    criado_em: item.criado_em,
    nomeCliente: item.fichas_caso?.nome_cliente ?? null,
  }));

  return { ok: true, teses };
}
