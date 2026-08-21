const LIMITE_PADRAO = 20;
const LIMITE_MAXIMO = 100;

export type ParametrosPaginacao = { limit: number; offset: number };

/**
 * Interpreta `?limit=&offset=` de uma URL pública (app/api/v1/*), sempre
 * devolvendo valores seguros: entradas ausentes/inválidas caem no padrão,
 * `limit` é sempre um inteiro positivo travado em `LIMITE_MAXIMO` (nunca
 * deixa um cliente pedir a tabela inteira de uma vez) e `offset` nunca é
 * negativo.
 */
export function parsearPaginacao(searchParams: URLSearchParams): ParametrosPaginacao {
  const limit = normalizarInteiro(searchParams.get("limit"), LIMITE_PADRAO, 1, LIMITE_MAXIMO);
  const offset = normalizarInteiro(searchParams.get("offset"), 0, 0, Number.MAX_SAFE_INTEGER);
  return { limit, offset };
}

function normalizarInteiro(bruto: string | null, padrao: number, min: number, max: number): number {
  if (bruto === null) return padrao;
  const valor = Number.parseInt(bruto, 10);
  if (!Number.isFinite(valor) || Number.isNaN(valor)) return padrao;
  return Math.min(Math.max(valor, min), max);
}
