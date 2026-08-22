import "server-only";

import type { IndiceMensal } from "./atualizacao-monetaria";

/**
 * Cliente da API SGS do Banco Central (Séries Temporárias) — sem chave,
 * gratuita, fonte OFICIAL das variações mensais dos índices.
 *
 * Séries usadas (código SGS):
 *   - 433  → IPCA variação % mensal (índice legal default pós Lei 14.905/2024)
 *   - 16122→ SELIC acumulada no mês (%)
 *
 * Resposta real: [{ "data": "01/01/2026", "valor": "0,45" }, ...]
 */

const BASE_SGS = "https://api.bcb.gov.br/dados/serie/bcdata.sgs";

export type IndiceDisponivel = "ipca" | "selic";

const CODIGO_POR_INDICE: Record<IndiceDisponivel, number> = {
  ipca: 433,
  selic: 16122,
};

function converterResposta(bruta: { data?: string; valor?: string }[]): IndiceMensal[] {
  const serie: IndiceMensal[] = [];
  for (const ponto of bruta) {
    const m = ponto.data?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    const valor = Number.parseFloat((ponto.valor ?? "").replace(",", "."));
    if (!m || !Number.isFinite(valor)) continue;
    serie.push({ anoMes: `${m[3]}-${m[2]}`, variacaoPercentual: valor });
  }
  return serie;
}

/**
 * Busca a variação % mensal do índice entre duas datas (inclusive os meses
 * que tocam o intervalo — o motor decide o que aplicar).
 */
export async function buscarSerieIndice(
  indice: IndiceDisponivel,
  dataInicial: string,
  dataFinal: string,
): Promise<IndiceMensal[]> {
  const [anoI, mesI] = dataInicial.split("-");
  const [anoF, mesF] = dataFinal.split("-");
  if (!anoI || !mesI || !anoF || !mesF) throw new Error("Datas inválidas para busca de índice.");

  // Ampla um mês antes/depois: o motor aplica só meses estritamente internos.
  const inicio = new Date(Date.UTC(Number(anoI), Number(mesI) - 2, 1, 12));
  const fim = new Date(Date.UTC(Number(anoF), Number(mesF), 1, 12));
  const formato = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;

  const url =
    `${BASE_SGS}.${CODIGO_POR_INDICE[indice]}/dados?formato=json` +
    `&dataInicial=${formato(inicio)}&dataFinal=${formato(fim)}`;

  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), 15_000);
  try {
    const resposta = await fetch(url, {
      signal: controlador.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!resposta.ok) throw new Error(`Banco Central respondeu HTTP ${resposta.status}.`);
    const bruta = (await resposta.json()) as { data?: string; valor?: string }[];
    return converterResposta(Array.isArray(bruta) ? bruta : []);
  } finally {
    clearTimeout(timer);
  }
}
