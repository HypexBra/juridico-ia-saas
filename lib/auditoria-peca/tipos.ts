/**
 * Tipos do resultado do Auditor de Peças (Fase 4, ADR 0012): auditoria de
 * peça processual (petição, contestação, recurso) com notas 0-10 por
 * dimensão, veredito de risco geral categórico, achados citáveis e
 * contra-argumentos prováveis do lado adverso.
 *
 * `CitacaoAnaliseProcesso` é reaproveitada de `lib/analise-processo/tipos.ts`
 * (ADR 0004) — mesmo contrato de rastreabilidade (`trechoOriginal`/`pagina`/
 * `certeza`) já usado por Document Intelligence (ADR 0011). Ver ADR 0012,
 * seção 3, para a decisão completa.
 */
import type { CitacaoAnaliseProcesso, NivelCertezaAnaliseProcesso } from "../analise-processo/tipos";

export type { CitacaoAnaliseProcesso, NivelCertezaAnaliseProcesso };

export const DIMENSOES_NOTA_AUDITORIA = ["fundamentacao", "coerencia", "pedidos", "jurisprudencia"] as const;
export type DimensaoNotaAuditoria = (typeof DIMENSOES_NOTA_AUDITORIA)[number];

/** Nota 0.0-10.0 (1 casa decimal) por dimensão — NUNCA um veredito
 * categórico (diferente de "riscos", que é sempre categórico, nunca
 * numérico). */
export type NotasAuditoriaPeca = Record<DimensaoNotaAuditoria, number>;

export const VEREDITOS_RISCO_AUDITORIA = ["baixo", "medio", "alto"] as const;
export type VereditoRiscoAuditoria = (typeof VEREDITOS_RISCO_AUDITORIA)[number];

export function ehVereditoRiscoAuditoriaValido(valor: string): valor is VereditoRiscoAuditoria {
  return (VEREDITOS_RISCO_AUDITORIA as readonly string[]).includes(valor);
}

export const CATEGORIAS_ACHADO_AUDITORIA = [
  "estrutura",
  "fatos",
  "fundamentacao",
  "legislacao",
  "jurisprudencia",
  "pedidos",
  "argumentacao",
  "inconsistencia",
  "omissao",
  "risco",
  "clareza",
] as const;
export type CategoriaAchadoAuditoria = (typeof CATEGORIAS_ACHADO_AUDITORIA)[number];

export const SEVERIDADES_ACHADO_AUDITORIA = ["informativo", "atencao", "critico"] as const;
export type SeveridadeAchadoAuditoria = (typeof SEVERIDADES_ACHADO_AUDITORIA)[number];

/** Achado citável — mesmo contrato de rastreabilidade da Fase 2/3
 * (`CitacaoAnaliseProcesso`: trechoOriginal/pagina/certeza), reaproveitado
 * sem redefinição. */
export type AchadoAuditoriaPeca = CitacaoAnaliseProcesso & {
  categoria: CategoriaAchadoAuditoria;
  severidade: SeveridadeAchadoAuditoria;
  descricao: string;
  /** Ajuste concreto sugerido — `null` quando não há ajuste a propor
   * (ex.: achado "informativo" só documentando um ponto forte). */
  sugestao: string | null;
};

/** Contra-argumento provável do lado adverso — categoria própria, não é
 * "achado" sobre a peça em si, é simulação adversarial do que a parte
 * contrária/o juiz pode contra-argumentar. */
export type ContraArgumentoProvavel = CitacaoAnaliseProcesso & {
  descricao: string;
  forca: "baixa" | "media" | "alta";
};

/**
 * Resultado completo da auditoria — pedido ao Gemini via `RESPONSE_SCHEMA`
 * (`lib/auditoria-peca/prompt.ts`) e persistido em
 * `auditorias_peca.resultado_auditoria` (jsonb). `notas` fixas em 4
 * dimensões numéricas (não inclui "riscos" como 5ª nota numérica): o
 * veredito de risco geral é sempre categórico (`veredictoRisco` +
 * `justificativaRisco`), nunca uma 5ª chave dentro do mesmo record numérico.
 */
export type ResultadoAuditoriaPeca = {
  tipoPeca: string;
  resumoExecutivo: string;
  notas: NotasAuditoriaPeca;
  veredictoRisco: VereditoRiscoAuditoria;
  justificativaRisco: string;
  achados: AchadoAuditoriaPeca[];
  contraArgumentosProvaveis: ContraArgumentoProvavel[];
  /** Sem citação — item que deveria constar e NÃO está no texto, mesmo
   * padrão de `informacoesAusentes` da Fase 3. */
  omissoesDetectadas: string[];
};
