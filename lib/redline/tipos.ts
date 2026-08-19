/**
 * Tipos do resultado da análise de risco contratual clause-by-clause
 * ("redline", feature Pro "analise_risco_contratual" — ver
 * `lib/planos/gating.ts` e migration 0017). Usados tanto pelo schema JSON
 * estruturado pedido à IA (`lib/redline/prompt.ts`) quanto pela coluna
 * `resultado_analise` (jsonb) em `analises_risco_contratual`.
 */
export const VEREDITOS_CLAUSULA = ["ok", "atencao", "risco_alto"] as const;

export type VereditoClausula = (typeof VEREDITOS_CLAUSULA)[number];

export const RÓTULO_VEREDITO: Record<VereditoClausula, string> = {
  ok: "OK",
  atencao: "Atenção",
  risco_alto: "Risco alto",
};

export type ClausulaAnalisada = {
  numero: number;
  trechoOriginal: string;
  veredito: VereditoClausula;
  /** Explicação curta do problema — `null` quando o veredito é "ok". */
  problema: string | null;
  /** Sugestão de ajuste de redação — `null` quando não há ajuste a propor. */
  sugestao: string | null;
};

/**
 * Resultado completo de uma análise. `quantidadeRiscoAlto` é sempre
 * CALCULADA em código a partir de `clausulas` (`lib/redline/prompt.ts`,
 * `contarRiscoAlto`) — nunca aceita o número que a IA eventualmente
 * mencionar no texto, pra não deixar uma contagem inconsistente com a lista
 * real de cláusulas entrar em produção.
 */
export type ResultadoAnaliseRisco = {
  clausulas: ClausulaAnalisada[];
  resumoGeral: string;
  quantidadeRiscoAlto: number;
};

export function ehVereditoValido(valor: string): valor is VereditoClausula {
  return (VEREDITOS_CLAUSULA as readonly string[]).includes(valor);
}
