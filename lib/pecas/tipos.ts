/**
 * Tipos de peça suportados pela redação assistida (migration 0016). Chave
 * estável usada em `pecas_geradas.tipo_peca` (constraint check no banco) e no
 * `<select>` da UI — nunca renomear sem migrar as linhas já gravadas.
 */
export const TIPOS_PECA = ["peticao_inicial", "contestacao", "recurso", "parecer"] as const;

export type TipoPeca = (typeof TIPOS_PECA)[number];

export const RÓTULO_TIPO_PECA: Record<TipoPeca, string> = {
  peticao_inicial: "Petição inicial",
  contestacao: "Contestação",
  recurso: "Recurso",
  parecer: "Parecer jurídico",
};

export function ehTipoPecaValido(valor: string): valor is TipoPeca {
  return (TIPOS_PECA as readonly string[]).includes(valor);
}
