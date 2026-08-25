import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { indexarJurisprudencias, type JurisprudenciaInput } from "@/lib/rag/jurisprudencia";

/**
 * Cliente do Portal de Dados Abertos do STJ (CKAN 2.10) — FONTE REAL
 * verificada nesta sessão (GET /api/3/action/package_search + download de
 * arquivo mensal real). Publica os "Espelhos de Acórdão" de todos os órgãos
 * julgadores em JSON mensal com texto integral da ementa + metadados
 * estruturados. Licença CC-BY (atribuição).
 *
 * Esquema CONFIRMADO lendo arquivo real (20260630.json, Corte Especial):
 *   id, numeroProcesso ("3637"), numeroRegistro ("202600409527"),
 *   siglaClasse/descricaoClasse, nomeOrgaoJulgador ("CORTE ESPECIAL"),
 *   ministroRelator, dataPublicacao ("DJEN       DATA:03/06/2026"),
 *   ementa (texto integral), dataDecisao?, decisao?, teseJuridica?, tema?
 */

const BASE_URL = "https://dadosabertos.web.stj.jus.br/api/3/action";

/** Órgãos julgadores ingeridos — datasets oficiais confirmados via package_search. */
export const DATASETS_STJ = [
  { datasetId: "espelhos-de-acordaos-corte-especial", orgao: "CORTE ESPECIAL" },
  { datasetId: "espelhos-de-acordaos-primeira-secao", orgao: "PRIMEIRA SEÇÃO" },
  { datasetId: "espelhos-de-acordaos-segunda-secao", orgao: "SEGUNDA SEÇÃO" },
  { datasetId: "espelhos-de-acordaos-terceira-secao", orgao: "TERCEIRA SEÇÃO" },
  { datasetId: "espelhos-de-acordaos-primeira-turma", orgao: "PRIMEIRA TURMA" },
  { datasetId: "espelhos-de-acordaos-segunda-turma", orgao: "SEGUNDA TURMA" },
  { datasetId: "espelhos-de-acordaos-terceira-turma", orgao: "TERCEIRA TURMA" },
  { datasetId: "espelhos-de-acordaos-quarta-turma", orgao: "QUARTA TURMA" },
  { datasetId: "espelhos-de-acordaos-quinta-turma", orgao: "QUINTA TURMA" },
  { datasetId: "espelhos-de-acordaos-sexta-turma", orgao: "SEXTA TURMA" },
] as const;

export type ResumoSyncOrgao = {
  datasetId: string;
  orgaoJulgador: string;
  status: "ok" | "pulado" | "erro";
  arquivo?: string;
  registrosLidos?: number;
  registrosNovos?: number;
  errosIngestao?: number;
  mensagemErro?: string;
};

type RecursoCkan = { format?: string; name?: string; url?: string };
type DatasetCkan = { resources?: RecursoCkan[] };

type EspelhoAcordaoStj = {
  id?: string;
  numeroProcesso?: string | null;
  numeroRegistro?: string | null;
  siglaClasse?: string | null;
  descricaoClasse?: string | null;
  nomeOrgaoJulgador?: string | null;
  ministroRelator?: string | null;
  dataPublicacao?: string | null;
  dataDecisao?: string | null;
  teseJuridica?: string | null;
  tema?: number | string | null;
  ementa?: string | null;
};

/**
 * Extrai AAAA-MM-DD de formatos reais observados:
 *   - "DJEN       DATA:03/06/2026"  (dataPublicacao dos espelhos)
 *   - "03/06/2026" / "03/06/26"
 *   - já ISO ("2026-06-03")
 */
export function parseDataStj(bruta: string | null | undefined): string | undefined {
  if (!bruta) return undefined;
  const iso = bruta.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = bruta.match(/DATA\s*:?\s*(\d{2})\/(\d{2})\/(\d{4})/) ?? bruta.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const curto = bruta.match(/(\d{2})\/(\d{2})\/(\d{2})\b/);
  if (curto) return `20${curto[3]}-${curto[2]}-${curto[1]}`;
  return undefined;
}

/** Campos extras (migration 0042) que o sync grava além do shape base do RAG. */
export type JurisprudenciaInputComFonte = JurisprudenciaInput & {
  orgao_julgador?: string;
  numero_registro?: string;
  tese?: string;
  tema?: number;
  origem?: string;
};

/** Mapeia um registro bruto do espelho para o shape de ingestão do RAG. */
export function mapearEspelhoParaInput(registro: EspelhoAcordaoStj): JurisprudenciaInputComFonte | null {
  const numeroProcesso = registro.numeroProcesso?.trim();
  const ementa = registro.ementa?.trim();
  if (!numeroProcesso || !ementa || ementa.length < 40) return null; // sem ementa real não é citável

  const temaBruto = registro.tema;
  const tema =
    typeof temaBruto === "number" ? temaBruto : typeof temaBruto === "string" && /^\d+$/.test(temaBruto.trim()) ? Number.parseInt(temaBruto.trim(), 10) : undefined;

  const input: JurisprudenciaInputComFonte = {
    tribunal: "stj",
    numero_processo: numeroProcesso,
    classe: registro.siglaClasse?.trim() ?? undefined,
    relator: registro.ministroRelator?.trim() ?? undefined,
    ementa,
    data_publicacao: parseDataStj(registro.dataPublicacao),
    data_julgamento: parseDataStj(registro.dataDecisao),
    orgao_julgador: registro.nomeOrgaoJulgador?.trim() ?? undefined,
    numero_registro: registro.numeroRegistro?.trim() ?? undefined,
    tese: registro.teseJuridica?.trim() || undefined,
    ...(tema !== undefined ? { tema } : {}),
    origem: "stj_dados_abertos",
  };
  return input;
}

async function buscarJson(url: string, timeoutMs = 60_000): Promise<unknown> {
  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), timeoutMs);
  try {
    const resposta = await fetch(url, { signal: controlador.signal });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status} ao baixar ${url}`);
    return await resposta.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Lista recursos JSON do dataset e devolve o mais recente pelo NOME (AAAAMMDD.json > lexicográfico). */
export function escolherArquivoMaisRecente(recursos: RecursoCkan[]): { nome: string; url: string } | null {
  const jsons = recursos.filter((r) => (r.format ?? "").toUpperCase() === "JSON" && r.url && r.name);
  if (jsons.length === 0) return null;
  const ordenado = [...jsons].sort((a, b) => ((a.name ?? "") < (b.name ?? "") ? 1 : -1));
  return { nome: ordenado[0].name as string, url: ordenado[0].url as string };
}

/**
 * Sincroniza um órgão: baixa o arquivo mensal MAIS RECENTE ainda não
 * ingerido (idempotência via fontes_stj_sync.ultimo_arquivo) e indexa no RAG.
 */
export async function sincronizarOrgaoStj(
  supabaseAdmin: SupabaseClient,
  datasetId: string,
  orgaoJulgador: string,
): Promise<ResumoSyncOrgao> {
  try {
    // Estado anterior (idempotência).
    const { data: estado } = await supabaseAdmin
      .from("fontes_stj_sync")
      .select("ultimo_arquivo")
      .eq("dataset_id", datasetId)
      .maybeSingle<{ ultimo_arquivo: string | null }>();

    const respostaDataset = await buscarJson(`${BASE_URL}/package_show?id=${datasetId}`) as {
      result?: DatasetCkan;
      success?: boolean;
    };
    const recursos = respostaDataset.result?.resources ?? [];
    const alvo = escolherArquivoMaisRecente(recursos);
    if (!alvo) {
      return { datasetId, orgaoJulgador, status: "erro", mensagemErro: "Nenhum recurso JSON no dataset." };
    }
    if (estado?.ultimo_arquivo === alvo.nome) {
      return { datasetId, orgaoJulgador, status: "pulado", arquivo: alvo.nome };
    }

    const conteudo = (await buscarJson(alvo.url)) as unknown;
    const registros = Array.isArray(conteudo)
      ? (conteudo as EspelhoAcordaoStj[])
      : Array.isArray((conteudo as { records?: unknown }).records)
        ? ((conteudo as { records: EspelhoAcordaoStj[] }).records)
        : [];

    let novos = 0;
    let erros = 0;
    const lote: JurisprudenciaInput[] = [];
    for (const bruto of registros) {
      const mapeado = mapearEspelhoParaInput(bruto);
      if (!mapeado) continue;

      // Upsert direto AQUI (não via indexarJurisprudencias) porque precisamos
      // gravar também os campos novos (orgao_julgador, tese, tema, origem) que
      // a função original não conhece — depois delegamos só a INDEXAÇÃO vetorial.
      const { data: salvo, error } = await supabaseAdmin
        .from("jurisprudencias")
        .upsert(
          {
            tribunal: "stj",
            numero_processo: mapeado.numero_processo,
            classe: mapeado.classe ?? null,
            relator: mapeado.relator ?? null,
            ementa: mapeado.ementa,
            inteiro_teor_url: mapeado.inteiro_teor_url ?? null,
            data_julgamento: mapeado.data_julgamento ?? null,
            data_publicacao: mapeado.data_publicacao ?? null,
            termo_busca: `stj_dados_abertos:${datasetId}`,
            orgao_julgador: mapeado.orgao_julgador ?? null,
            numero_registro: mapeado.numero_registro ?? null,
            tese: mapeado.tese ?? null,
            tema: mapeado.tema ?? null,
            origem: "stj_dados_abertos",
          },
          { onConflict: "tribunal,numero_processo" },
        )
        .select("id")
        .single();

      if (error || !salvo) {
        erros += 1;
        continue;
      }
      lote.push(mapeado);
      novos += 1;
    }

    // Indexação vetorial das ementas novas/atualizadas (best-effort por item,
    // falha de embedding nunca derruba a sincronização inteira).
    let errosIngestao = erros;
    if (lote.length > 0) {
      const resultados = await indexarJurisprudencias(supabaseAdmin, lote);
      errosIngestao += resultados.filter((r) => !r.ok).length;
    }

    await supabaseAdmin.from("fontes_stj_sync").upsert(
      {
        dataset_id: datasetId,
        orgao_julgador: orgaoJulgador,
        ultimo_arquivo: alvo.nome,
        registros_ingeridos: registros.length,
        registros_novos: novos,
        erros: errosIngestao,
        ultimo_sync_em: new Date().toISOString(),
      },
      { onConflict: "dataset_id" },
    );

    return {
      datasetId,
      orgaoJulgador,
      status: "ok",
      arquivo: alvo.nome,
      registrosLidos: registros.length,
      registrosNovos: novos,
      errosIngestao,
    };
  } catch (erro) {
    return {
      datasetId,
      orgaoJulgador,
      status: "erro",
      mensagemErro: erro instanceof Error ? erro.message : String(erro),
    };
  }
}

/** Sincroniza TODOS os órgãos (usado pelo cron mensal e pelo botão admin). */
export async function sincronizarJurisprudenciaStj(supabaseAdmin: SupabaseClient): Promise<ResumoSyncOrgao[]> {
  const resultados: ResumoSyncOrgao[] = [];
  for (const { datasetId, orgao } of DATASETS_STJ) {
    resultados.push(await sincronizarOrgaoStj(supabaseAdmin, datasetId, orgao));
  }
  return resultados;
}
