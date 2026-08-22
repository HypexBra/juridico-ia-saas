/**
 * ATUALIZAÇÃO MONETÁRIA + JUROS — motor puro (sem I/O), Fase 16.
 *
 * Regra de produto (Fase 16 do roadmap): todo cálculo mostra RESULTADO,
 * FÓRMULA, PREMISSAS, PARÂMETROS, DATA-BASE e FONTES — nunca se apresenta
 * como certeza jurídica absoluta (atualização de dívida depende de título,
 * contrato e interpretação; o demonstrativo é ferramenta de apoio).
 *
 * Motor recebe a SÉRIE DE ÍNDICES como parâmetro (busca na API do Banco
 * Central é camada separada — lib/calculadoras/indices-bcb.ts), então é
 * 100% testável offline.
 */

export type IndiceMensal = {
  /** AAAA-MM */
  anoMes: string;
  /** Variação percentual do mês (ex: 0.45 = 0,45%). */
  variacaoPercentual: number;
};

export type TipoJuros = "simples" | "compostos";

export type ParametrosAtualizacao = {
  valorOriginal: number;
  /** Data-base inicial (YYYY-MM-DD) — data do débito originário. */
  dataInicial: string;
  /** Data-base final (YYYY-MM-DD) — data do cálculo/pagamento. */
  dataFinal: string;
  /**
   * Série mensal do índice de correção entre as datas (variação % por mês).
   * Vazio = sem correção monetária (só juros).
   */
  serieIndice: IndiceMensal[];
  /** Taxa de juros % ao mês. Ex: 1 = 1% a.m.; 0 para não aplicar. */
  taxaJurosMensalPercentual: number;
  tipoJuros: TipoJuros;
  /** Multa contratual/legal em % sobre o principal corrigido (opcional). */
  multaPercentual?: number;
  /** Honorários advocatícios contratuais em % sobre o total (opcional). */
  honorariosPercentual?: number;
};

export type LinhaDemonstrativo = { anoMes: string; fatorAplicado: number; valorAcumulado: number };

export type ResultadoAtualizacao = {
  valorCorrigido: number;
  juros: number;
  multa: number;
  honorarios: number;
  total: number;
  mesesCorrigidos: number;
  diasJuros: number;
  demonstrativo: LinhaDemonstrativo[];
  formulas: string[];
  premissas: string[];
  fontes: string[];
};

function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function diferencaEmDias(a: string, b: string): number {
  const ms = new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * Calcula atualização monetária composta pela série mensal + juros pro-rata
 * die sobre o principal corrigido (padrão da jurisprudência civil: correção
 * incide sobre o principal, juros incidem sobre o principal CORRIGIDO).
 */
export function calcularAtualizacaoMonetaria(params: ParametrosAtualizacao): ResultadoAtualizacao {
  if (!(params.valorOriginal > 0)) throw new Error("Valor original deve ser maior que zero.");
  if (params.dataFinal < params.dataInicial) throw new Error("Data final anterior à data inicial.");

  const formulas: string[] = [];
  const premissas: string[] = [];
  const fontes: string[] = [];

  // ── Correção monetária (fatores compostos dos índices entre as datas) ──
  let fatorAcumulado = 1;
  const demonstrativo: LinhaDemonstrativo[] = [];
  for (const ponto of params.serieIndice) {
    // O índice do mês M corrige valores vencidos até o mês ANTERIOR — aqui
    // aplicamos os meses ESTRITAMENTE posteriores à data inicial e anteriores
    // ou iguais ao mês da data final (premissa conservadora padrão dos
    // demonstrativos judiciais; ajuste fino de dia fica para conferência).
    const [anoStr, mesStr] = ponto.anoMes.split("-");
    const primeiroDiaMes = `${anoStr}-${mesStr}-01`;
    if (primeiroDiaMes <= params.dataInicial || primeiroDiaMes > params.dataFinal) continue;
    const fator = 1 + ponto.variacaoPercentual / 100;
    fatorAcumulado *= fator;
    demonstrativo.push({ anoMes: ponto.anoMes, fatorAplicado: arredondar(fator), valorAcumulado: arredondar(params.valorOriginal * fatorAcumulado) });
  }
  const valorCorrigido = params.valorOriginal * fatorAcumulado;
  const mesesCorrigidos = demonstrativo.length;

  if (mesesCorrigidos > 0) {
    formulas.push(
      `Correção: ${params.valorOriginal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} × Π(1 + variação% do índice) = ${valorCorrigido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} (fator acumulado ${arredondar(fatorAcumulado)})`,
    );
    fontes.push("Série mensal do índice informada pelo Banco Central (SGS) no momento do cálculo.");
  } else {
    formulas.push("Sem série de correção aplicável ao período informado — principal não corrigido.");
    premissas.push("Confirme se o intervalo entre as datas contém variações publicadas do índice escolhido.");
  }

  // ── Juros pro-rata die sobre o PRINCIPAL CORRIGIDO ──
  const diasJuros = Math.max(0, diferencaEmDias(params.dataInicial, params.dataFinal));
  let juros = 0;
  const taxaMensal = params.taxaJurosMensalPercentual / 100;
  if (taxaMensal > 0 && diasJuros > 0) {
    const fracaoMensal = diasJuros / 30;
    if (params.tipoJuros === "simples") {
      juros = valorCorrigido * taxaMensal * fracaoMensal;
      formulas.push(`Juros simples: principal corrigido × ${params.taxaJurosMensalPercentual}% a.m. × ${diasJuros}/30 dias`);
    } else {
      juros = valorCorrigido * (Math.pow(1 + taxaMensal, fracaoMensal) - 1);
      formulas.push(
        `Juros compostos: principal corrigido × [(1 + ${params.taxaJurosMensalPercentual}% a.m.)^(${diasJuros}/30) − 1]`,
      );
    }
  }

  // ── Multa e honorários (opcionais, sobre bases distintas e explícitas) ──
  const baseMulta = valorCorrigido + juros;
  const multa = params.multaPercentual ? baseMulta * (params.multaPercentual / 100) : 0;
  const subtotalComMulta = baseMulta + multa;
  const honorarios = params.honorariosPercentual ? subtotalComMulta * (params.honorariosPercentual / 100) : 0;

  if (params.multaPercentual) formulas.push(`Multa: (${principalCorrigidoTexto(valorCorrigido)} + juros) × ${params.multaPercentual}%`);
  if (params.honorariosPercentual) formulas.push(`Honorários: (corrigido + juros + multa) × ${params.honorariosPercentual}%`);

  premissas.push("Juros incidem sobre o principal CORRIGIDO (padrão civil consolidado).");
  premissas.push("Fração de mês convertida pro-rata die com divisor 30.");
  premissas.push("Cálculo auxiliar — não substitui liquidação por contador/perito quando exigida pelo juízo.");
  fontes.push("Lei 14.905/2024: IPCA como índice legal default (CC, art. 389) e Taxa Legal para juros (art. 406).");

  return {
    valorCorrigido: arredondar(valorCorrigido),
    juros: arredondar(juros),
    multa: arredondar(multa),
    honorarios: arredondar(honorarios),
    total: arredondar(valorCorrigido + juros + multa + honorarios),
    mesesCorrigidos,
    diasJuros,
    demonstrativo,
    formulas,
    premissas,
    fontes,
  };
}

function principalCorrigidoTexto(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Converte uma taxa % a.a. em % a.m. equivalente (juros compostos). */
export function anualParaMensal(taxaAnualPercentual: number): number {
  return (Math.pow(1 + taxaAnualPercentual / 100, 1 / 12) - 1) * 100;
}
