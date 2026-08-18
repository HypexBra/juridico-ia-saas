import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { buscarTodasComunicacoesDjen, type ComunicacaoDjen } from "./cliente";
import { calcularPrazoProcessual, formatarDataISO } from "@/lib/prazos/calculo";

/**
 * Motor de sincronização DJEN → propostas de prazo. NUNCA cria prazo direto
 * no banco: toda intimação nova vira uma `propostas_acao` (tipo
 * `create_prazo`, status `pending`) usando o mesmo fluxo de aprovação humana
 * de `app/app/chat/propostas-actions.ts` — o advogado revisa a data sugerida
 * (o texto da intimação nem sempre deixa claro o prazo exato em dias, então
 * o valor calculado aqui é uma SUGESTÃO conservadora, não a palavra final)
 * e só então aprova.
 *
 * Idempotência: cada linha de `sincronizacoes_djen` guarda
 * `ultimo_id_comunicacao_processado` — o `id` retornado pelo DJEN é uma
 * sequência numérica global e crescente da própria API, então "processar de
 * novo" é definido como "id <= último id já visto para esta OAB". A janela
 * de busca por data (ver `janelaDeBusca`) é só para não pedir "toda a
 * história" a cada consulta; a garantia real de não duplicar vem do
 * comparador numérico de id, não da data.
 */

const PRAZO_PADRAO_DIAS_UTEIS = 15; // regra geral supletiva mais comum (CPC art. 218, §3º); ajustável pelo advogado antes de aprovar
const DIAS_HISTORICO_PRIMEIRA_SINCRONIZACAO = 7; // evita importar anos de histórico na primeira consulta de uma OAB nova
const MARGEM_SOBREPOSICAO_DIAS = 2; // reconsulta alguns dias pra trás mesmo já tendo sincronizado, por causa de publicações retroativas

const PALAVRAS_CHAVE_PRAZO_EM_DOBRO = [
  "fazenda pública",
  "fazenda nacional",
  "fazenda estadual",
  "fazenda municipal",
  "defensoria pública",
  "advocacia-geral da união",
  "procuradoria-geral",
  "instituto nacional do seguro social",
  " inss ",
  "união federal",
  "distrito federal",
];

/** Heurística sobre o texto da intimação — DJEN não expõe um campo estruturado "parte é ente público". */
function detectarPrazoEmDobro(texto: string): boolean {
  const alvo = ` ${texto.toLowerCase()} `;
  return PALAVRAS_CHAVE_PRAZO_EM_DOBRO.some((chave) => alvo.includes(chave));
}

const payloadCreatePrazoDjenSchema = z.object({
  dados: z.object({
    titulo: z.string().trim().min(1).max(255),
    descricao: z.string().trim().max(4000),
    data_prazo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    processo: z.string().trim().max(100).optional(),
    numero_processo_cnj: z.string().trim().max(25).optional(),
    origem: z.literal("djen"),
    tribunal: z.string().trim().max(20).optional(),
    data_intimacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    prazo_em_dobro: z.boolean(),
  }),
  motivo: z.string().trim().min(1).max(500),
});

function montarPayloadProposta(item: ComunicacaoDjen) {
  const prazoEmDobro = detectarPrazoEmDobro(item.texto);
  const dataIntimacao = item.data_disponibilizacao; // já vem YYYY-MM-DD da API
  const dataSugerida = formatarDataISO(
    calcularPrazoProcessual({ dataIntimacao, diasUteis: PRAZO_PADRAO_DIAS_UTEIS, prazoEmDobro }),
  );

  const dados = {
    titulo: `Intimação — ${item.tipoComunicacao} (${item.siglaTribunal})`.slice(0, 255),
    descricao: `${item.texto}\n\n[Sugestão automática: ${PRAZO_PADRAO_DIAS_UTEIS} dias úteis${
      prazoEmDobro ? " em dobro (parte pública detectada no texto)" : ""
    } a partir da disponibilização em ${dataIntimacao}. Confira o prazo exato na intimação antes de aprovar — o motivo/tipo de manifestação não é analisado automaticamente.]`.slice(
      0,
      4000,
    ),
    data_prazo: dataSugerida,
    processo: item.numeroprocessocommascara?.slice(0, 100),
    numero_processo_cnj: item.numeroprocessocommascara?.slice(0, 25),
    origem: "djen" as const,
    tribunal: item.siglaTribunal?.slice(0, 20),
    data_intimacao: dataIntimacao,
    prazo_em_dobro: prazoEmDobro,
  };

  const motivo = `Importado automaticamente do DJEN (comunicação nº ${item.id}, órgão: ${item.nomeOrgao}).`;

  return payloadCreatePrazoDjenSchema.parse({ dados, motivo });
}

function montarResumoDjen(item: ComunicacaoDjen): string {
  return `Nova intimação do DJEN — processo ${item.numeroprocessocommascara ?? item.numero_processo} (${item.siglaTribunal}). Sugestão de prazo baseada em ${PRAZO_PADRAO_DIAS_UTEIS} dias úteis; revise antes de aprovar.`;
}

/** [dataInicio, dataFim] no formato YYYY-MM-DD usado pela API do DJEN. */
function janelaDeBusca(ultimaConsultaEm: string | null, hoje = new Date()): { dataInicio: string; dataFim: string } {
  const fim = formatarDataISO(hoje);
  if (!ultimaConsultaEm) {
    const inicio = new Date(hoje);
    inicio.setUTCDate(inicio.getUTCDate() - DIAS_HISTORICO_PRIMEIRA_SINCRONIZACAO);
    return { dataInicio: formatarDataISO(inicio), dataFim: fim };
  }

  const ultima = new Date(ultimaConsultaEm);
  ultima.setUTCDate(ultima.getUTCDate() - MARGEM_SOBREPOSICAO_DIAS);
  return { dataInicio: formatarDataISO(ultima), dataFim: fim };
}

function separarOabEUf(oabConsultada: string): { numeroOab: string; ufOab: string } | null {
  const [numero, uf] = oabConsultada.split("/");
  if (!numero || !uf) return null;
  return { numeroOab: numero.trim(), ufOab: uf.trim().toUpperCase() };
}

export type ResultadoSincronizacaoOab = {
  oab: string;
  ok: boolean;
  propostasCriadas: number;
  erro?: string;
};

/**
 * Sincroniza uma única OAB de um escritório: consulta o DJEN desde a última
 * sincronização, filtra o que já foi processado e cria uma proposta de
 * criação de prazo para cada comunicação nova.
 */
export async function sincronizarOab(
  supabase: SupabaseClient,
  escritorioId: string,
  oabConsultada: string,
): Promise<ResultadoSincronizacaoOab> {
  const partes = separarOabEUf(oabConsultada);
  if (!partes) {
    return { oab: oabConsultada, ok: false, propostasCriadas: 0, erro: `OAB em formato inválido: "${oabConsultada}" (esperado NÚMERO/UF, ex: 123456/SP).` };
  }

  const { data: sync } = await supabase
    .from("sincronizacoes_djen")
    .select("*")
    .eq("escritorio_id", escritorioId)
    .eq("oab_consultada", oabConsultada)
    .maybeSingle();

  const { dataInicio, dataFim } = janelaDeBusca(sync?.ultima_consulta_em ?? null);
  const ultimoIdProcessado = sync?.ultimo_id_comunicacao_processado
    ? Number(sync.ultimo_id_comunicacao_processado)
    : null;

  const resultado = await buscarTodasComunicacoesDjen({
    numeroOab: partes.numeroOab,
    ufOab: partes.ufOab,
    dataInicio,
    dataFim,
  });

  if (!resultado.ok) {
    return { oab: oabConsultada, ok: false, propostasCriadas: 0, erro: resultado.error };
  }

  const novos = resultado.items
    .filter((item) => ultimoIdProcessado === null || item.id > ultimoIdProcessado)
    .sort((a, b) => a.id - b.id);

  let propostasCriadas = 0;
  for (const item of novos) {
    try {
      const { dados, motivo } = montarPayloadProposta(item);
      const { error } = await supabase.from("propostas_acao").insert({
        escritorio_id: escritorioId,
        conversa_id: null,
        criado_por: null,
        tipo: "create_prazo",
        tabela_alvo: "prazos",
        registro_id: null,
        resumo: montarResumoDjen(item),
        payload: { dados, motivo },
      });
      if (!error) propostasCriadas++;
    } catch {
      // Item com dado inesperado (ex: data_disponibilizacao ausente) não
      // derruba a sincronização inteira — pula e segue para o próximo; o
      // maior id ainda avança até aqui, então não fica reprocessando o
      // mesmo item quebrado indefinidamente.
    }
  }

  const maiorId = novos.length > 0 ? novos[novos.length - 1].id : ultimoIdProcessado;

  await supabase.from("sincronizacoes_djen").upsert(
    {
      escritorio_id: escritorioId,
      oab_consultada: oabConsultada,
      ultima_consulta_em: new Date().toISOString(),
      ultimo_id_comunicacao_processado: maiorId !== null ? String(maiorId) : null,
    },
    { onConflict: "escritorio_id,oab_consultada" },
  );

  return { oab: oabConsultada, ok: true, propostasCriadas };
}

/**
 * Ponto de entrada do cron: para cada escritório com ao menos um perfil com
 * OAB cadastrada, sincroniza cada OAB distinta. Usa um client service_role
 * (sem sessão de usuário) — ver lib/supabase/admin.ts.
 */
export async function sincronizarTodosEscritorios(supabase: SupabaseClient): Promise<ResultadoSincronizacaoOab[]> {
  const { data: perfis, error } = await supabase
    .from("perfis")
    .select("escritorio_id, oab")
    .eq("ativo", true)
    .not("oab", "is", null);

  if (error || !perfis) return [];

  const combinacoesUnicas = new Map<string, { escritorioId: string; oab: string }>();
  for (const perfil of perfis) {
    const oab = (perfil.oab as string | null)?.trim();
    if (!oab) continue;
    const chave = `${perfil.escritorio_id}:${oab}`;
    combinacoesUnicas.set(chave, { escritorioId: perfil.escritorio_id as string, oab });
  }

  const resultados: ResultadoSincronizacaoOab[] = [];
  // Sequencial (não Promise.all) de propósito: evita disparar N requisições
  // simultâneas contra uma API pública do governo e sofrer rate limit em
  // massa — o DJEN já é tratado com retry/backoff por chamada, mas rodar em
  // série reduz a chance de acionar esse caminho em primeiro lugar.
  for (const { escritorioId, oab } of combinacoesUnicas.values()) {
    const resultado = await sincronizarOab(supabase, escritorioId, oab);
    resultados.push(resultado);
  }

  return resultados;
}
