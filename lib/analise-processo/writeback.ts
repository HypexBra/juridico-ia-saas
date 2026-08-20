/**
 * Lógica pura (sem I/O) do write-back automático de uma
 * `analises_processo.resultado_analise` para `pessoas_caso`/`eventos_caso`/
 * `teses_caso`, e da montagem de `propostas_acao` para os prazos
 * identificados (gate humano obrigatório — ver ADR 0004, seção 2). Mantido
 * isolado de Server Actions/Supabase, mesmo padrão de `lib/casos/pessoas.ts`/
 * `lib/casos/teses.ts` — toda regra testável sem banco fica aqui.
 */
import type { TipoPessoaCaso } from "@/lib/types";
import type { EventoAnaliseProcesso, PessoaAnaliseProcesso, PrazoIdentificadoAnaliseProcesso } from "./tipos";

export type StatusAnaliseProcessoParaWriteback = "processando" | "pronto" | "erro";

export type AnaliseParaWriteback = {
  status: StatusAnaliseProcessoParaWriteback;
  writeback_aplicado_em: string | null;
  resultado_analise: unknown;
};

export type VerificacaoWriteback = { ok: true } | { ok: false; motivo: string };

/**
 * Guardrail de idempotência: só permite aplicar o write-back quando a
 * análise está `pronto` (resultado disponível), tem `resultado_analise`
 * preenchido e ainda NÃO foi aplicada antes (`writeback_aplicado_em` nulo).
 * Chamar sempre ANTES de qualquer escrita em `pessoas_caso`/`eventos_caso`/
 * `teses_caso`/`propostas_acao` — nunca aplicar duas vezes a mesma análise.
 */
export function verificarPodeAplicarWriteback(analise: AnaliseParaWriteback): VerificacaoWriteback {
  if (analise.status !== "pronto" || !analise.resultado_analise) {
    return { ok: false, motivo: "Esta análise ainda não está concluída." };
  }
  if (analise.writeback_aplicado_em) {
    return { ok: false, motivo: "O resultado desta análise já foi aplicado ao caso anteriormente." };
  }
  return { ok: true };
}

/** Itens com `certeza: "nao_encontrado"` nunca são gravados como fato no caso — só exibidos na análise em si. */
export function filtrarItensConfiaveis<T extends { certeza: string }>(itens: T[]): T[] {
  return itens.filter((item) => item.certeza !== "nao_encontrado");
}

const PALAVRAS_ADVERSO = ["réu", "reu", "requerido", "executado", "reclamad", "denunciad", "apelad"];
const PALAVRAS_PARTE = ["autor", "requerente", "exequente", "reclamante", "apelante", "impetrante", "embargante"];
const PALAVRAS_TESTEMUNHA = ["testemunha"];

/**
 * Heurística determinística (sem IA) para mapear o campo livre `papel`
 * (texto extraído do documento, ex: "Réu", "Autor da ação", "Testemunha
 * arrolada pela defesa") para o enum fixo de `pessoas_caso.tipo`. Qualquer
 * papel não reconhecido cai em `"terceiro"` — nunca lança erro, nunca
 * inventa um tipo mais específico do que o texto sustenta.
 */
export function inferirTipoPessoaCasoDoPapel(papel: string): TipoPessoaCaso {
  const normalizado = papel
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

  if (PALAVRAS_TESTEMUNHA.some((p) => normalizado.includes(p))) return "testemunha";
  if (PALAVRAS_ADVERSO.some((p) => normalizado.includes(p))) return "adverso";
  if (PALAVRAS_PARTE.some((p) => normalizado.includes(p))) return "parte";
  return "terceiro";
}

export type PessoaCasoInputDaAnalise = {
  tipo: TipoPessoaCaso;
  nome: string;
  documento: string | null;
  contato: string | null;
  papelProcessual: string | null;
};

/**
 * Monta o INPUT (mesmo shape de `PessoaCasoInput`, `lib/casos/pessoas.ts`) a
 * partir de um item de `pessoasPartes` já filtrado por `certeza` — o
 * chamador ainda passa este resultado por `montarPayloadPessoaCaso` para
 * aplicar a normalização real (validação de CPF/CNPJ, trim etc.) antes do
 * insert, exatamente como o formulário manual de "Pessoas do caso" faz.
 */
export function montarPessoaCasoDaAnaliseProcesso(item: PessoaAnaliseProcesso): PessoaCasoInputDaAnalise | null {
  const nome = item.nome.trim();
  if (!nome) return null;

  return {
    tipo: inferirTipoPessoaCasoDoPapel(item.papel),
    nome,
    documento: item.documento?.trim() || null,
    contato: null,
    papelProcessual: item.papel.trim() || null,
  };
}

const REGEX_DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Devolve a data em ISO (`data_evento`) do evento, ou `null` quando o documento não trouxe data. */
export function resolverDataEventoAnaliseProcesso(item: EventoAnaliseProcesso): string | null {
  if (!item.data) return null;
  return REGEX_DATA_ISO.test(item.data.trim()) ? new Date(`${item.data.trim()}T00:00:00Z`).toISOString() : null;
}

export type PropostaPrazoAnaliseProcesso = {
  dados: {
    titulo: string;
    descricao: string;
    data_prazo: string;
    ficha_caso_id: string;
  };
  motivo: string;
};

/**
 * Monta os dados de uma proposta `create_prazo` a partir de um item de
 * `prazosIdentificados` já filtrado por `certeza`. Devolve `null` quando o
 * item não tem uma data em formato `YYYY-MM-DD` válido — prazo sem data
 * confiável NUNCA gera proposta (evita propor um prazo real com data
 * inventada/ambígua); nesse caso o item continua visível na aba de análise,
 * só não vira proposta automática (o advogado pode criar manualmente se
 * quiser). `fichaCasoId` é sempre gravado no payload (mesmo sendo
 * `prazos.ficha_caso_id` uma coluna nullable no schema): sem ele o prazo
 * criado por `aprovarPropostaAction` fica órfão, sem aparecer na ficha que
 * originou a análise (achado de segurança/integridade pós-revisão, ADR 0004).
 */
export function montarPropostaPrazoDaAnaliseProcesso(
  item: PrazoIdentificadoAnaliseProcesso,
  nomeArquivoOrigem: string,
  fichaCasoId: string,
): PropostaPrazoAnaliseProcesso | null {
  const titulo = item.titulo.trim();
  const data = item.data?.trim();
  if (!titulo || !data || !REGEX_DATA_ISO.test(data)) return null;

  return {
    dados: {
      titulo,
      descricao: item.descricao.trim(),
      data_prazo: data,
      ficha_caso_id: fichaCasoId,
    },
    motivo: `Prazo identificado pela análise inteligente do documento "${nomeArquivoOrigem}".`,
  };
}

/** Resumo humano exibido no card de aprovação da proposta — nunca usa texto livre não estruturado. */
export function montarResumoPropostaPrazoAnaliseProcesso(proposta: PropostaPrazoAnaliseProcesso): string {
  return `Criar prazo "${proposta.dados.titulo}" para ${proposta.dados.data_prazo} (${proposta.motivo})`;
}

export type ContagemWritebackAnaliseProcesso = {
  pessoasInseridas: number;
  eventosInseridos: number;
  tesesInseridas: number;
  propostasPrazoCriadas: number;
  prazosIgnoradosSemData: number;
};

export function contagemWritebackVazia(): ContagemWritebackAnaliseProcesso {
  return { pessoasInseridas: 0, eventosInseridos: 0, tesesInseridas: 0, propostasPrazoCriadas: 0, prazosIgnoradosSemData: 0 };
}
