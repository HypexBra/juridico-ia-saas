/**
 * Tipos do resultado de Document Intelligence (Fase 3, ADR 0011): análise
 * individual/em lote de UM documento avulso (`ResultadoAnaliseDocumento`,
 * migration 0033, `analises_documento`) e comparação A×B
 * (`ResultadoComparacaoDocumento`, migration 0034, `comparacoes_documento`).
 *
 * `CitacaoAnaliseProcesso` é reaproveitada de `lib/analise-processo/tipos.ts`
 * (ADR 0004) em vez de redefinida — mesmo contrato de rastreabilidade
 * (`trechoOriginal`/`pagina`/`certeza`) entre as duas features, ver ADR 0011
 * seção 4.
 */
import type { CitacaoAnaliseProcesso, NivelCertezaAnaliseProcesso } from "../analise-processo/tipos";

export type { CitacaoAnaliseProcesso, NivelCertezaAnaliseProcesso };

/** Mesmo formato de `VereditoClausula` (`lib/redline/tipos.ts`, ADR 0017) —
 * reaproveitado como sub-schema de `clausulas[]` (ADR 0011, seção 3). */
export const VEREDITOS_CLAUSULA_DOC = ["ok", "atencao", "risco_alto"] as const;
export type VereditoClausulaDoc = (typeof VEREDITOS_CLAUSULA_DOC)[number];

export function ehVereditoClausulaDocValido(valor: string): valor is VereditoClausulaDoc {
  return (VEREDITOS_CLAUSULA_DOC as readonly string[]).includes(valor);
}

/** Ponto-chave em destaque no resumo executivo (seção "pontosChave"). */
export type PontoChaveAnaliseDocumento = CitacaoAnaliseProcesso & {
  descricao: string;
};

/** Cláusula identificada e avaliada (formato do redline + citação da Fase 2). */
export type ClausulaAnaliseDocumento = CitacaoAnaliseProcesso & {
  numero: number;
  veredito: VereditoClausulaDoc;
  /** Explicação curta do problema — `null` quando o veredito é "ok". */
  problema: string | null;
  /** Sugestão de ajuste de redação — `null` quando não há ajuste a propor. */
  sugestao: string | null;
};

export type DataEntidadeAnaliseDocumento = CitacaoAnaliseProcesso & {
  data: string;
  descricao: string;
};

export type ValorEntidadeAnaliseDocumento = CitacaoAnaliseProcesso & {
  valor: string;
  descricao: string;
};

export type ParteEntidadeAnaliseDocumento = CitacaoAnaliseProcesso & {
  nome: string;
  papel: string;
};

export type EntidadesAnaliseDocumento = {
  datas: DataEntidadeAnaliseDocumento[];
  valores: ValorEntidadeAnaliseDocumento[];
  partes: ParteEntidadeAnaliseDocumento[];
};

export type InconsistenciaAnaliseDocumento = CitacaoAnaliseProcesso & {
  descricao: string;
};

export type RiscoAnaliseDocumento = CitacaoAnaliseProcesso & {
  descricao: string;
  nivel: "baixo" | "medio" | "alto";
};

/**
 * Resultado completo da análise individual de um documento avulso — pedido
 * ao Gemini via `RESPONSE_SCHEMA` (`lib/analise-documento/prompt.ts`) e
 * persistido em `analises_documento.resultado_analise` (jsonb). `clausulas`
 * pode vir vazio quando o documento não tem estrutura clausular (ex: uma
 * petição) — a IA decide isso a partir do `tipoDocumento` classificado, sem
 * campo de configuração no formulário (ADR 0011, seção 4).
 * `informacoesAusentes` é o único array sem citação, mesmo padrão da Fase 2.
 */
export type ResultadoAnaliseDocumento = {
  tipoDocumento: string;
  resumoExecutivo: string;
  pontosChave: PontoChaveAnaliseDocumento[];
  clausulas: ClausulaAnaliseDocumento[];
  entidades: EntidadesAnaliseDocumento;
  inconsistencias: InconsistenciaAnaliseDocumento[];
  riscos: RiscoAnaliseDocumento[];
  informacoesAusentes: string[];
};

export const TIPOS_MUDANCA_CLAUSULA_COMPARADA = [
  "adicionada",
  "removida",
  "alterada",
  "inalterada_relevante",
] as const;
export type TipoMudancaClausulaComparada = (typeof TIPOS_MUDANCA_CLAUSULA_COMPARADA)[number];

/**
 * Item do diff estruturado da comparação A×B (ADR 0011, seção 5). Em vez de
 * um único `trechoOriginal`/`pagina` (padrão de 1 documento), carrega um PAR
 * (`trechoA`/`paginaA`, `trechoB`/`paginaB`) — a obrigatoriedade de cada lado
 * depende de `tipoMudanca` (ver `.refine()` em
 * `lib/analise-documento/prompt-comparacao.ts`):
 * - "adicionada": `trechoA: null`, `trechoB` preenchido;
 * - "removida": `trechoB: null`, `trechoA` preenchido;
 * - "alterada" / "inalterada_relevante": ambos preenchidos.
 */
export type ClausulaComparada = {
  tipoMudanca: TipoMudancaClausulaComparada;
  trechoA: string | null;
  paginaA: number | null;
  trechoB: string | null;
  paginaB: number | null;
  certeza: NivelCertezaAnaliseProcesso;
  resumoMudanca: string;
  /** `null` quando a mudança não implica risco. */
  risco: "baixo" | "medio" | "alto" | null;
};

/** Subconjunto de `clausulas[]` com risco médio/alto, com descrição adicional. */
export type ClausulaComparadaComRisco = ClausulaComparada & {
  descricao: string;
};

/**
 * Resultado completo da comparação de 2 documentos — pedido ao Gemini via
 * `RESPONSE_SCHEMA` (`lib/analise-documento/prompt-comparacao.ts`) e
 * persistido em `comparacoes_documento.resultado_comparacao` (jsonb).
 * `recomendacoes` é sem citação, mesmo papel de `informacoesAusentes`/
 * `proximasAcoes` da Fase 2.
 */
export type ResultadoComparacaoDocumento = {
  resumoGeral: string;
  clausulas: ClausulaComparada[];
  riscosIntroduzidos: ClausulaComparadaComRisco[];
  recomendacoes: string[];
};
