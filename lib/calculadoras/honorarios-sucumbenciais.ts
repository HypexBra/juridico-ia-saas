/**
 * HONORÁRIOS SUCUMBENCIAIS — motor puro (sem I/O), Fase 16.
 *
 * Faixas PROGRESSIVAS do art. 85 §5º CPC (redação Lei 14.363/2022), em URM
 * (Unidade de Referência = salário mínimo vigente à data do pagamento):
 *   até 1.000 URM ............ 20%
 *   de 1.000 a 2.000 URM ..... 15% sobre o que exceder 1.000
 *   de 2.000 a 20.000 URM .... 10% sobre o que exceder 2.000
 *   de 20.000 a 50.000 URM ... 8% sobre o que exceder 20.000
 *   acima de 50.000 URM ...... 5% sobre o que exceder 50.000
 * Cálculo idêntico ao do IR: cada fatia é tributada pela taxa da própria
 * faixa (o erro clássico dos cálculos manuais — apontado na pesquisa de
 * mercado como dor nº3 — é aplicar a taxa da última faixa no valor inteiro).
 *
 * Sucumbência recursal (§11): 50% sobre o valor da sucumbência anterior,
 * fixada sobre a parcela alterada/recorrida.
 */

export const FAIXAS_ART85 = [
  { limiteInferior: 0, limiteSuperior: 1_000, percentual: 20 },
  { limiteInferior: 1_000, limiteSuperior: 2_000, percentual: 15 },
  { limiteInferior: 2_000, limiteSuperior: 20_000, percentual: 10 },
  { limiteInferior: 20_000, limiteSuperior: 50_000, percentual: 8 },
  { limiteInferior: 50_000, limiteSuperior: Number.POSITIVE_INFINITY, percentual: 5 },
] as const;

export type LinhaFaixaHonorarios = {
  faixa: string;
  baseNaFaixa: number;
  percentual: number;
  valor: number;
};

export type ResultadoSucumbenciais = {
  valorDaCondenacao: number;
  salariosMinimosReferencia: number;
  totalHonorarios: number;
  percentualEfetivo: number;
  linhasPorFaixa: LinhaFaixaHonorarios[];
  sucumbenciaRecursal: number | null;
  formulas: string[];
  premissas: string[];
};

function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/**
 * Calcula honorários sucumbenciais progressivos.
 * @param valorCondenacao valor da condenação/a proveito em R$
 * @param salarioMinimo valor do SM usado como URM (vigente à data do pagamento)
 */
export function calcularSucumbenciaisArt85(
  valorCondenacao: number,
  salarioMinimo: number,
  aplicarRecursal = false,
): ResultadoSucumbenciais {
  if (!(valorCondenacao > 0)) throw new Error("Valor da condenação deve ser maior que zero.");
  if (!(salarioMinimo > 0)) throw new Error("Salário mínimo deve ser maior que zero.");

  const urm = valorCondenacao / salarioMinimo;
  const linhasPorFaixa: LinhaFaixaHonorarios[] = [];
  let totalEmUrm = 0;

  for (const faixa of FAIXAS_ART85) {
    if (urm <= faixa.limiteInferior) break;
    const baseNaFaixaUrm = Math.min(urm, faixa.limiteSuperior) - faixa.limiteInferior;
    const valorFaixaUrm = baseNaFaixaUrm * (faixa.percentual / 100);
    totalEmUrm += valorFaixaUrm;
    linhasPorFaixa.push({
      faixa:
        faixa.limiteSuperior === Number.POSITIVE_INFINITY
          ? `Acima de ${faixa.limiteInferior.toLocaleString("pt-BR")} URM`
          : `De ${faixa.limiteInferior.toLocaleString("pt-BR")} a ${faixa.limiteSuperior.toLocaleString("pt-BR")} URM`,
      baseNaFaixa: arredondar(baseNaFaixaUrm * salarioMinimo),
      percentual: faixa.percentual,
      valor: arredondar(valorFaixaUrm * salarioMinimo),
    });
  }

  const totalHonorarios = totalEmUrm * salarioMinimo;
  let sucumbenciaRecursal: number | null = null;
  if (aplicarRecursal) {
    // §11: fixados em 50% do valor atribuído à fase anterior.
    sucumbenciaRecursal = arredondar(totalHonorarios * 0.5);
  }

  return {
    valorDaCondenacao: arredondar(valorCondenacao),
    salariosMinimosReferencia: arredondar(urm),
    totalHonorarios: arredondar(totalHonorarios),
    percentualEfetivo: arredondar((totalHonorarios / valorCondenacao) * 100),
    linhasPorFaixa,
    sucumbenciaRecursal,
    formulas: [
      `URM = condenação ÷ SM = ${valorCondenacao.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} ÷ ${salarioMinimo.toLocaleString("pt-BR")} = ${arredondar(urm).toLocaleString("pt-BR")} URM`,
      "Honorários = Σ(base da faixa × % da faixa) — progressão igual ao modelo do IR.",
      ...(aplicarRecursal ? ["Recursal (art. 85 §11): 50% dos honorários da fase anterior."] : []),
    ],
    premissas: [
      "Percentuais legais máximos das faixas do art. 85 §5º CPC; o juiz pode reduzir (§2º) — confira a sentença.",
      "URM usa o SM vigente À DATA DO PAGAMENTO; se o pagamento ainda não ocorreu, use o SM atual e refaça na liquidação.",
      "Não inclui honorários contratuais nem sucumbência fixada em sentença específica — quando houver valor fixado, ele PREVALECE sobre este cálculo.",
    ],
  };
}
