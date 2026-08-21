"use server";

import { revalidatePath } from "next/cache";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { planoTemAcesso } from "@/lib/planos/gating";
import {
  existeProcessamentoIaEmAndamento,
  MENSAGEM_PROCESSAMENTO_IA_EM_ANDAMENTO,
} from "@/lib/ia/limite-concorrencia";
import {
  analisarDocumentoProcesso,
  TIPOS_ARQUIVO_ANALISE_PROCESSO,
  type TipoArquivoAnaliseProcesso,
} from "@/lib/analise-processo/analisar";
import { montarPayloadPessoaCaso } from "@/lib/casos/pessoas";
import { registrarEventoCaso } from "@/lib/casos/timeline";
import { montarNovaTeseCaso, montarTeseCasoDaAnaliseProcesso } from "@/lib/casos/teses";
import {
  contagemWritebackVazia,
  filtrarItensConfiaveis,
  montarPessoaCasoDaAnaliseProcesso,
  montarPropostaPrazoDaAnaliseProcesso,
  montarResumoPropostaPrazoAnaliseProcesso,
  resolverDataEventoAnaliseProcesso,
  verificarPodeAplicarWriteback,
  type ContagemWritebackAnaliseProcesso,
} from "@/lib/analise-processo/writeback";
import type { AnaliseProcesso } from "@/lib/types";

/** Mesmo teto de `app/app/base-conhecimento/actions.ts` (ADR 0004, seção 6). */
const MAX_TAMANHO_ARQUIVO_ANALISE = 15 * 1024 * 1024;

const EXTENSOES_POR_TIPO: Record<TipoArquivoAnaliseProcesso, string[]> = {
  pdf: [".pdf"],
  docx: [".docx"],
  imagem: [".jpg", ".jpeg", ".png", ".webp"],
};

const MIME_POR_TIPO: Record<TipoArquivoAnaliseProcesso, string[]> = {
  pdf: ["application/pdf"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  imagem: ["image/jpeg", "image/png", "image/webp"],
};

/**
 * Decide o `tipo_arquivo` (`analises_processo.tipo_arquivo`) a partir do MIME
 * type e/ou extensão do arquivo enviado — mesma tolerância de
 * `uploadDocumentoAction` (base de conhecimento), que já lida com navegadores
 * reportando MIME type vazio/genérico para alguns formatos. Devolve `null`
 * quando o arquivo não bate com nenhum dos 3 formatos suportados.
 */
function inferirTipoArquivoAnaliseProcesso(arquivo: File): TipoArquivoAnaliseProcesso | null {
  const nomeMinusculo = arquivo.name.toLowerCase();
  for (const tipo of TIPOS_ARQUIVO_ANALISE_PROCESSO) {
    if (MIME_POR_TIPO[tipo].includes(arquivo.type) || EXTENSOES_POR_TIPO[tipo].some((ext) => nomeMinusculo.endsWith(ext))) {
      return tipo;
    }
  }
  return null;
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Confirma que a ficha existe e é visível ao usuário logado (RLS de
 * `fichas_caso` já restringe ao escritório atual) — mesmo guard de
 * `app/app/fichas/[id]/pessoas-actions.ts#fichaExisteEVisivel`, repetido aqui
 * porque não há um módulo compartilhado para esse helper específico ainda.
 */
async function fichaExisteEVisivel(supabase: SupabaseServerClient, fichaCasoId: string): Promise<boolean> {
  const { data, error } = await supabase.from("fichas_caso").select("id").eq("id", fichaCasoId).maybeSingle();
  if (error) {
    console.error("[analise-processo-actions/fichaExisteEVisivel] Falha ao verificar ficha:", error, {
      fichaCasoId,
    });
    return false;
  }
  return data !== null;
}

export type UploadAnaliseProcessoResultado =
  | { ok: true; analise: AnaliseProcesso }
  | { ok: false; error: string };

/**
 * Upload + análise inteligente de um documento do processo (feature Pro
 * "analise_inteligente_processo", ADR 0004). Processamento SÍNCRONO dentro
 * da própria Server Action (sem fila — decisão da ADR seção 6): a linha em
 * `analises_processo` é criada com `status = "processando"` ANTES da chamada
 * de IA, então se a function morrer por timeout a UI mostra "processando"
 * (nunca um erro silencioso) e o advogado pode tentar de novo.
 */
export async function uploadEAnalisarProcessoAction(
  fichaCasoId: string,
  formData: FormData,
): Promise<UploadAnaliseProcessoResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  if (!planoTemAcesso(usuario.perfil.escritorio, "analise_inteligente_processo")) {
    return { ok: false, error: "Análise inteligente de processo é um recurso do plano Pro." };
  }

  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ok: false, error: "Selecione um arquivo (PDF, DOCX ou imagem)." };
  }
  if (arquivo.size > MAX_TAMANHO_ARQUIVO_ANALISE) {
    return { ok: false, error: "Arquivo muito grande (limite de 15MB)." };
  }

  const tipoArquivo = inferirTipoArquivoAnaliseProcesso(arquivo);
  if (!tipoArquivo) {
    return { ok: false, error: "Formato não suportado. Envie um PDF, DOCX ou imagem (jpg/png/webp)." };
  }

  const supabase = await createClient();
  if (!(await fichaExisteEVisivel(supabase, fichaCasoId))) {
    return { ok: false, error: "Ficha não encontrada." };
  }

  const { escritorio_id: escritorioId, id: perfilId } = usuario.perfil;

  if (await existeProcessamentoIaEmAndamento(escritorioId)) {
    return { ok: false, error: MENSAGEM_PROCESSAMENTO_IA_EM_ANDAMENTO };
  }

  const { data: analise, error: erroInsert } = await supabase
    .from("analises_processo")
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
    .single<AnaliseProcesso>();

  if (erroInsert || !analise) {
    console.error("[analise-processo-actions/uploadEAnalisarProcessoAction] Falha ao registrar análise:", erroInsert, {
      fichaCasoId,
    });
    return { ok: false, error: "Não foi possível registrar a análise. Tente novamente." };
  }

  const buffer = Buffer.from(await arquivo.arrayBuffer());
  const resultado = await analisarDocumentoProcesso({ buffer, tipoArquivo, nomeArquivo: arquivo.name });

  const agora = new Date().toISOString();

  if (!resultado.ok) {
    await supabase
      .from("analises_processo")
      .update({ status: "erro", erro: resultado.erro, processado_em: agora })
      .eq("id", analise.id);

    revalidatePath(`/app/fichas/${fichaCasoId}`);
    return { ok: false, error: resultado.erro };
  }

  const { data: analiseAtualizada, error: erroUpdate } = await supabase
    .from("analises_processo")
    .update({
      status: "pronto",
      resultado_analise: resultado.resultado,
      modelo_ia_usado: resultado.modeloIaUsado,
      processado_em: agora,
    })
    .eq("id", analise.id)
    .select("*")
    .single<AnaliseProcesso>();

  if (erroUpdate || !analiseAtualizada) {
    console.error(
      "[analise-processo-actions/uploadEAnalisarProcessoAction] IA respondeu, mas falhou ao salvar o resultado:",
      erroUpdate,
      { analiseId: analise.id },
    );
    return { ok: false, error: "A IA analisou o documento, mas houve um erro ao salvar o resultado. Tente novamente." };
  }

  // Mesmo padrão de `redline/actions.ts`/`fichas/actions.ts`: uma linha por
  // chamada de IA em `uso_ia` (contagem de chamadas, não de tokens — ver
  // `.agents/memoria/senior-engineer.md`). `analisarDocumentoProcesso` não
  // expõe contagem de tokens hoje (chamada isolada em `lib/analise-processo/analisar.ts`,
  // fora de `lib/ia/provider.ts`), então tokens_in/tokens_out ficam no
  // default (0) da coluna em vez de um número inventado.
  await supabase.from("uso_ia").insert({ escritorio_id: escritorioId, mes_ref: agora.slice(0, 7) });

  revalidatePath(`/app/fichas/${fichaCasoId}`);
  return { ok: true, analise: analiseAtualizada };
}

export type ListarAnalisesProcessoResultado =
  | { ok: true; analises: AnaliseProcesso[] }
  | { ok: false; error: string };

/** Lista as análises de processo já feitas para a ficha, mais recentes primeiro. */
export async function listarAnalisesProcessoAction(fichaCasoId: string): Promise<ListarAnalisesProcessoResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("analises_processo")
    .select("*")
    .eq("ficha_caso_id", fichaCasoId)
    .order("criado_em", { ascending: false })
    .returns<AnaliseProcesso[]>();

  if (error) {
    console.error("[analise-processo-actions/listarAnalisesProcessoAction] Falha ao listar análises:", error, {
      fichaCasoId,
    });
    return { ok: false, error: "Não foi possível carregar as análises de processo. Tente novamente." };
  }

  return { ok: true, analises: data ?? [] };
}

export type AplicarWritebackResultado =
  | { ok: true; contagem: ContagemWritebackAnaliseProcesso }
  | { ok: false; error: string };

/**
 * Aplica o write-back de uma análise concluída ao caso (ADR 0004, seção 2):
 * - `pessoasPartes`/`linhaDoTempo`/`tesesPossiveis` gravam DIRETO (aditivo,
 *   reversível pelo advogado), reusando os helpers puros já usados pela
 *   Fase 1 (`montarPayloadPessoaCaso`, `registrarEventoCaso`,
 *   `montarNovaTeseCaso`).
 * - `prazosIdentificados` NUNCA grava direto em `prazos` — cada prazo com
 *   data válida vira uma `propostas_acao` (`tipo: "create_prazo"`) pendente
 *   de aprovação humana, mesmo pipeline do chat
 *   (`app/app/chat/propostas-actions.ts`).
 * - Itens com `certeza: "nao_encontrado"` são ignorados por completo (nunca
 *   viram fato no caso).
 * - Idempotente: `writeback_aplicado_em` (migration 0031) é checado ANTES de
 *   qualquer escrita e marcado no fim — clicar "Aplicar ao caso" duas vezes
 *   na mesma análise não duplica nada.
 */
export async function aplicarWriteBackAnaliseProcessoAction(analiseId: string): Promise<AplicarWritebackResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  if (!planoTemAcesso(usuario.perfil.escritorio, "analise_inteligente_processo")) {
    return { ok: false, error: "Análise inteligente de processo é um recurso do plano Pro." };
  }

  const supabase = await createClient();
  const { data: analise, error: erroBusca } = await supabase
    .from("analises_processo")
    .select("*")
    .eq("id", analiseId)
    .maybeSingle<AnaliseProcesso>();

  if (erroBusca || !analise) {
    console.error("[analise-processo-actions/aplicarWriteBackAnaliseProcessoAction] Análise não encontrada:", erroBusca, {
      analiseId,
    });
    return { ok: false, error: "Análise não encontrada." };
  }

  const verificacao = verificarPodeAplicarWriteback(analise);
  if (!verificacao.ok) return { ok: false, error: verificacao.motivo };

  const resultado = analise.resultado_analise!;
  const { escritorio_id: escritorioId, id: perfilId } = usuario.perfil;
  const fichaCasoId = analise.ficha_caso_id;
  const contagem = contagemWritebackVazia();

  for (const item of filtrarItensConfiaveis(resultado.pessoasPartes)) {
    const payload = montarPessoaCasoDaAnaliseProcesso(item);
    if (!payload) continue;
    const { error } = await supabase
      .from("pessoas_caso")
      .insert({ escritorio_id: escritorioId, ficha_caso_id: fichaCasoId, ...montarPayloadPessoaCaso(payload) });
    if (error) {
      console.error("[analise-processo-actions/writeback] Falha ao inserir pessoa do caso:", error, { analiseId });
      continue;
    }
    contagem.pessoasInseridas += 1;
  }

  for (const item of filtrarItensConfiaveis(resultado.linhaDoTempo)) {
    const resultadoEvento = await registrarEventoCaso(supabase, {
      escritorioId,
      fichaCasoId,
      tipoEvento: "documento_analisado",
      descricao: item.descricao,
      dataEvento: resolverDataEventoAnaliseProcesso(item) ?? undefined,
      origem: "documento",
      referenciaId: analise.id,
      criadoPor: perfilId,
    });
    if (resultadoEvento.ok) contagem.eventosInseridos += 1;
  }

  for (const item of filtrarItensConfiaveis(resultado.tesesPossiveis)) {
    const teseMontada = montarTeseCasoDaAnaliseProcesso(item);
    if (!teseMontada) continue;
    const { error } = await supabase.from("teses_caso").insert(
      montarNovaTeseCaso({
        escritorioId,
        fichaCasoId,
        tese: teseMontada.tese,
        fundamentacao: teseMontada.fundamentacao,
      }),
    );
    if (error) {
      console.error("[analise-processo-actions/writeback] Falha ao inserir tese do caso:", error, { analiseId });
      continue;
    }
    contagem.tesesInseridas += 1;
  }

  for (const item of filtrarItensConfiaveis(resultado.prazosIdentificados)) {
    const proposta = montarPropostaPrazoDaAnaliseProcesso(item, analise.nome_arquivo, fichaCasoId);
    if (!proposta) {
      contagem.prazosIgnoradosSemData += 1;
      continue;
    }
    const { error } = await supabase.from("propostas_acao").insert({
      escritorio_id: escritorioId,
      conversa_id: null,
      criado_por: perfilId,
      tipo: "create_prazo",
      tabela_alvo: "prazos",
      registro_id: null,
      resumo: montarResumoPropostaPrazoAnaliseProcesso(proposta),
      payload: proposta,
      status: "pending",
    });
    if (error) {
      console.error("[analise-processo-actions/writeback] Falha ao criar proposta de prazo:", error, { analiseId });
      continue;
    }
    contagem.propostasPrazoCriadas += 1;
  }

  const { error: erroMarcar } = await supabase
    .from("analises_processo")
    .update({ writeback_aplicado_em: new Date().toISOString() })
    .eq("id", analise.id);

  if (erroMarcar) {
    console.error(
      "[analise-processo-actions/aplicarWriteBackAnaliseProcessoAction] Write-back aplicado, mas falhou ao marcar como concluído:",
      erroMarcar,
      { analiseId },
    );
  }

  revalidatePath(`/app/fichas/${fichaCasoId}`);
  revalidatePath("/app/chat");
  revalidatePath("/app/prazos");
  return { ok: true, contagem };
}
