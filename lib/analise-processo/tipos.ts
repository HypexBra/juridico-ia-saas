/**
 * Tipos do resultado da análise inteligente de processo (feature Pro
 * "analise_inteligente_processo" — ver `lib/planos/gating.ts` e migration
 * `0030`, tabela `analises_processo`). Usados tanto pelo `RESPONSE_SCHEMA`
 * nativo do Gemini pedido à IA (`lib/analise-processo/prompt.ts`) quanto
 * pela coluna `resultado_analise` (jsonb) em `analises_processo`.
 *
 * Ver `docs/adrs/0004-analise-inteligente-processos.md`, seção 4/5, para a
 * decisão completa. Espelha o padrão de `lib/redline/tipos.ts`
 * (`ClausulaAnalisada`/`ResultadoAnaliseRisco`).
 */

/**
 * Nível de confiança de CADA afirmação extraída do documento (obrigatório
 * em todo item de array que representa um fato, exceto `informacoesAusentes`
 * — ver seção 5 do ADR 0004). `nao_encontrado` é o valor explícito e
 * obrigatório quando o documento não dá base para preencher o campo — nunca
 * inventar; `inferido` existe só para deduções razoáveis a partir de uma
 * premissa explícita (também citada em `trechoOriginal`).
 */
export const NIVEIS_CERTEZA_ANALISE_PROCESSO = ["confirmado", "inferido", "nao_encontrado"] as const;

export type NivelCertezaAnaliseProcesso = (typeof NIVEIS_CERTEZA_ANALISE_PROCESSO)[number];

export function ehNivelCertezaValido(valor: string): valor is NivelCertezaAnaliseProcesso {
  return (NIVEIS_CERTEZA_ANALISE_PROCESSO as readonly string[]).includes(valor);
}

/**
 * Campos de rastreabilidade presentes em TODO item de array das 12 seções,
 * exceto `informacoesAusentes` (array de strings livre, sem citação — é
 * justamente o que NÃO está no documento). `pagina` é `null` para DOCX
 * (sem paginação fixa) e para itens cuja origem não é uma página específica.
 */
export type CitacaoAnaliseProcesso = {
  trechoOriginal: string;
  pagina: number | null;
  certeza: NivelCertezaAnaliseProcesso;
};

/** Seção 2 — linha do tempo dos fatos/atos processuais identificados. */
export type EventoAnaliseProcesso = CitacaoAnaliseProcesso & {
  data: string | null;
  descricao: string;
};

/** Seção 3 — pessoas/partes envolvidas identificadas no documento. */
export type PessoaAnaliseProcesso = CitacaoAnaliseProcesso & {
  nome: string;
  papel: string;
  documento: string | null;
};

/** Seção 4 — documentos mencionados/anexados encontrados no material. */
export type DocumentoEncontradoAnaliseProcesso = CitacaoAnaliseProcesso & {
  tipo: string;
  descricao: string;
};

/** Seção 5 — questões jurídicas centrais identificadas. */
export type QuestaoJuridicaAnaliseProcesso = CitacaoAnaliseProcesso & {
  questao: string;
};

/** Seção 6 — teses jurídicas possíveis (nascem `em_avaliacao` em `teses_caso`). */
export type TesePossivelAnaliseProcesso = CitacaoAnaliseProcesso & {
  tese: string;
  fundamentacao: string;
};

/** Seção 7 — evidências/provas mencionadas ou anexadas. */
export type EvidenciaAnaliseProcesso = CitacaoAnaliseProcesso & {
  descricao: string;
};

/** Seção 8 — contradições/inconsistências encontradas no documento. */
export type ContradicaoAnaliseProcesso = CitacaoAnaliseProcesso & {
  descricao: string;
};

/** Seção 10 — riscos identificados para o caso. */
export type RiscoAnaliseProcesso = CitacaoAnaliseProcesso & {
  descricao: string;
  nivel: "baixo" | "medio" | "alto";
};

/**
 * Seção 11 — prazos identificados. NUNCA grava direto em `prazos` (peso
 * jurídico de perda de direito): sempre passa por `propostas_acao`
 * (`tipo: "create_prazo"`), gate humano obrigatório — ver ADR 0004 seção 2.
 */
export type PrazoIdentificadoAnaliseProcesso = CitacaoAnaliseProcesso & {
  titulo: string;
  data: string | null;
  descricao: string;
};

/** Seção 12 — próximas ações recomendadas ao advogado. */
export type ProximaAcaoAnaliseProcesso = CitacaoAnaliseProcesso & {
  acao: string;
};

/** Seção 12 — perguntas a investigar / lacunas que exigem confirmação humana. */
export type PerguntaInvestigarAnaliseProcesso = CitacaoAnaliseProcesso & {
  pergunta: string;
};

/**
 * Resultado completo da análise — as 12 seções pedidas ao Gemini via
 * `RESPONSE_SCHEMA` (`lib/analise-processo/prompt.ts`) e persistidas em
 * `analises_processo.resultado_analise` (jsonb). `informacoesAusentes` é o
 * único array sem citação (ver `CitacaoAnaliseProcesso`) — espaço dedicado
 * para o modelo listar lacunas relevantes em vez de supor.
 */
export type ResultadoAnaliseProcesso = {
  resumoExecutivo: string;
  linhaDoTempo: EventoAnaliseProcesso[];
  pessoasPartes: PessoaAnaliseProcesso[];
  documentosEncontrados: DocumentoEncontradoAnaliseProcesso[];
  questoesJuridicas: QuestaoJuridicaAnaliseProcesso[];
  tesesPossiveis: TesePossivelAnaliseProcesso[];
  evidencias: EvidenciaAnaliseProcesso[];
  contradicoes: ContradicaoAnaliseProcesso[];
  informacoesAusentes: string[];
  riscos: RiscoAnaliseProcesso[];
  prazosIdentificados: PrazoIdentificadoAnaliseProcesso[];
  proximasAcoes: ProximaAcaoAnaliseProcesso[];
  perguntasInvestigar: PerguntaInvestigarAnaliseProcesso[];
};
