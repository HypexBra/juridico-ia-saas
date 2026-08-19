import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolverMailMerge, type ResultadoMailMerge } from "./mail-merge";
import { montarDadosMailMergeDaFicha } from "./montar-dados-mail-merge";

export type ModeloMailMerge = { id: string; nome: string; conteudo: string };

export type ParametrosGeracaoDocumentoFicha = {
  fichaId: string;
  modeloId: string;
  /** `perfis.escritorio_id` do usuário autenticado, para o snapshot de auditoria. */
  escritorioId: string;
  /** `perfis.id` do usuário autenticado, para o snapshot de auditoria. */
  perfilId: string;
};

export type ResultadoGeracaoDocumentoFicha =
  | { ok: true; modelo: ModeloMailMerge; resultado: ResultadoMailMerge }
  | { ok: false; error: string };

type ModeloRow = { id: string; nome: string; conteudo: string };
type FichaRow = { id: string; nome_cliente: string | null; area_direito: string | null; cliente_id: string | null };

/**
 * Orquestração única do fluxo "gerar documento a partir de modelo" (mail-
 * merge jurídico, migration 0010): busca o modelo e a ficha, resolve
 * `{{nome_cliente}}`/`{{numero_processo}}`/`{{area_direito}}`/
 * `{{valor_causa}}`/`{{data_hoje}}` contra os dados reais do caso (com
 * fallback de nome do cliente via `clientes.nome` e uso do prazo/contrato de
 * honorário mais recentes vinculados à ficha), roda o motor puro
 * (`resolverMailMerge`) e grava sempre o snapshot de auditoria em
 * `peticoes_geradas` — mesmo quando alguma variável não foi resolvida (a
 * geração nunca é bloqueada por isso, só reportada).
 *
 * Usada tanto pela Server Action de preview/cópia
 * (`app/app/fichas/actions.ts`) quanto pela Route Handler de download do
 * .docx (`app/api/fichas/[id]/documento/route.ts`) — único ponto de
 * orquestração, para não duplicar a busca de dados nem o mail-merge em dois
 * lugares.
 */
export async function gerarDocumentoDaFicha(
  supabase: SupabaseClient,
  params: ParametrosGeracaoDocumentoFicha,
): Promise<ResultadoGeracaoDocumentoFicha> {
  if (!params.modeloId) {
    return { ok: false, error: "Selecione um modelo para gerar o documento." };
  }

  const { data: modeloData, error: erroModelo } = await supabase
    .from("modelos")
    .select("id, nome, conteudo")
    .eq("id", params.modeloId)
    .maybeSingle();

  if (erroModelo || !modeloData) {
    return { ok: false, error: "Modelo não encontrado." };
  }
  const modelo = modeloData as ModeloRow;

  const { data: fichaData, error: erroFicha } = await supabase
    .from("fichas_caso")
    .select("id, nome_cliente, area_direito, cliente_id")
    .eq("id", params.fichaId)
    .maybeSingle();

  if (erroFicha || !fichaData) {
    return { ok: false, error: "Ficha não encontrada." };
  }
  const ficha = fichaData as FichaRow;

  // `fichas_caso.nome_cliente` é preenchido na triagem, mas nem toda ficha
  // tem esse campo direto — quando ausente, busca o nome via `cliente_id`
  // (contrato documentado na migration 0010, comentário do `{{nome_cliente}}`).
  let nomeClientePorRelacao: string | null = null;
  if (!ficha.nome_cliente && ficha.cliente_id) {
    const { data: cliente } = await supabase
      .from("clientes")
      .select("nome")
      .eq("id", ficha.cliente_id)
      .maybeSingle<{ nome: string | null }>();
    nomeClientePorRelacao = cliente?.nome ?? null;
  }

  // Uma ficha pode ter vários prazos; usa o mais recente que já tenha número
  // de processo CNJ preenchido (nem todo prazo tem, ex: prazos internos sem
  // processo formal ainda distribuído).
  const { data: prazoComProcesso } = await supabase
    .from("prazos")
    .select("numero_processo_cnj")
    .eq("ficha_caso_id", params.fichaId)
    .not("numero_processo_cnj", "is", null)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle<{ numero_processo_cnj: string | null }>();

  // Idem para contrato de honorário: pega o mais recente vinculado à ficha.
  const { data: contrato } = await supabase
    .from("contratos_honorario")
    .select("valor_total")
    .eq("ficha_caso_id", params.fichaId)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle<{ valor_total: number | null }>();

  const dadosResolvidos = montarDadosMailMergeDaFicha({
    nomeClienteFicha: ficha.nome_cliente,
    nomeClientePorRelacao,
    areaDireito: ficha.area_direito,
    numeroProcessoCnj: prazoComProcesso?.numero_processo_cnj ?? null,
    valorCausaTotal: contrato?.valor_total ?? null,
  });

  const resultado = resolverMailMerge(modelo.conteudo, dadosResolvidos);

  const { error: erroInsercao } = await supabase.from("peticoes_geradas").insert({
    escritorio_id: params.escritorioId,
    modelo_id: modelo.id,
    ficha_caso_id: params.fichaId,
    gerado_por: params.perfilId,
    variaveis_usadas: resultado.variaveisUsadas,
  });

  if (erroInsercao) {
    console.error("[peticoes/gerarDocumentoDaFicha] Falha ao registrar documento gerado:", erroInsercao, {
      fichaId: params.fichaId,
      modeloId: params.modeloId,
    });
    return {
      ok: false,
      error: "O documento foi gerado, mas houve um erro ao registrar a auditoria. Tente novamente.",
    };
  }

  return {
    ok: true,
    modelo: { id: modelo.id, nome: modelo.nome, conteudo: modelo.conteudo },
    resultado,
  };
}
