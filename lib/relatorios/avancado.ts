/**
 * Relatório financeiro avançado (feature premium `relatorios_avancados`,
 * ver lib/planos/gating.ts): realization rate (recebido / contratado) e
 * breakdown por caso e por área do direito.
 *
 * Puro/sem I/O de propósito — quem chama busca fichas/contratos/parcelas do
 * Supabase e passa aqui já carregados, o que torna a lógica trivialmente
 * testável sem mockar banco (ver avancado.test.ts).
 */

export type StatusParcelaRelatorio = "pendente" | "pago" | "atrasado";

export type FichaParaRelatorioAvancado = {
  id: string;
  nomeCliente: string;
  areaDireito: string | null;
};

export type ContratoParaRelatorioAvancado = {
  contratoId: string;
  fichaCasoId: string;
  valorTotal: number | null;
};

export type ParcelaParaRelatorioAvancado = {
  contratoId: string;
  valor: number;
  status: StatusParcelaRelatorio;
};

export type LinhaRelatorioPorCaso = {
  fichaCasoId: string;
  nomeCliente: string;
  areaDireito: string;
  valorContratado: number;
  valorRecebido: number;
  valorPendenteOuAtrasado: number;
  realizationRate: number | null;
};

export type LinhaRelatorioPorArea = {
  areaDireito: string;
  totalCasos: number;
  valorContratado: number;
  valorRecebido: number;
  realizationRate: number | null;
};

export type RelatorioAvancado = {
  valorContratadoTotal: number;
  valorRecebidoTotal: number;
  realizationRateGeral: number | null;
  porCaso: LinhaRelatorioPorCaso[];
  porArea: LinhaRelatorioPorArea[];
  quantidadeIndeterminada: number;
};

const AREA_NAO_INFORMADA = "Não informada";

/**
 * Calcula o relatório avançado a partir de fichas/contratos/parcelas já
 * carregados. Regras de negócio propositais (cobertas em avancado.test.ts):
 *
 * - Contratos cuja `fichaCasoId` não corresponde a nenhuma ficha carregada
 *   (dados órfãos) são ignorados por completo.
 * - Um caso com QUALQUER contrato sem `valorTotal` fica "indeterminado":
 *   nunca inventa um valor contratado, então entra em `quantidadeIndeterminada`
 *   e não contribui pros totais nem tem `realizationRate` (fica `null`).
 */
export function calcularRelatorioAvancado(
  fichas: FichaParaRelatorioAvancado[],
  contratos: ContratoParaRelatorioAvancado[],
  parcelas: ParcelaParaRelatorioAvancado[],
): RelatorioAvancado {
  const fichasPorId = new Map(fichas.map((ficha) => [ficha.id, ficha]));

  const contratosPorFicha = new Map<string, ContratoParaRelatorioAvancado[]>();
  for (const contrato of contratos) {
    if (!fichasPorId.has(contrato.fichaCasoId)) continue;
    const lista = contratosPorFicha.get(contrato.fichaCasoId) ?? [];
    lista.push(contrato);
    contratosPorFicha.set(contrato.fichaCasoId, lista);
  }

  const parcelasPorContrato = new Map<string, ParcelaParaRelatorioAvancado[]>();
  for (const parcela of parcelas) {
    const lista = parcelasPorContrato.get(parcela.contratoId) ?? [];
    lista.push(parcela);
    parcelasPorContrato.set(parcela.contratoId, lista);
  }

  let valorContratadoTotal = 0;
  let valorRecebidoTotal = 0;
  let quantidadeIndeterminada = 0;
  const porCaso: LinhaRelatorioPorCaso[] = [];

  for (const [fichaCasoId, contratosDoCaso] of contratosPorFicha) {
    const ficha = fichasPorId.get(fichaCasoId);
    if (!ficha) continue;
    const areaDireito = ficha.areaDireito ?? AREA_NAO_INFORMADA;

    const indeterminado = contratosDoCaso.some((contrato) => contrato.valorTotal === null);
    if (indeterminado) {
      quantidadeIndeterminada += 1;
      porCaso.push({
        fichaCasoId,
        nomeCliente: ficha.nomeCliente,
        areaDireito,
        valorContratado: 0,
        valorRecebido: 0,
        valorPendenteOuAtrasado: 0,
        realizationRate: null,
      });
      continue;
    }

    const valorContratado = contratosDoCaso.reduce((soma, contrato) => soma + (contrato.valorTotal ?? 0), 0);
    let valorRecebido = 0;
    let valorPendenteOuAtrasado = 0;
    for (const contrato of contratosDoCaso) {
      const parcelasDoContrato = parcelasPorContrato.get(contrato.contratoId) ?? [];
      for (const parcela of parcelasDoContrato) {
        if (parcela.status === "pago") valorRecebido += parcela.valor;
        else valorPendenteOuAtrasado += parcela.valor;
      }
    }

    valorContratadoTotal += valorContratado;
    valorRecebidoTotal += valorRecebido;
    porCaso.push({
      fichaCasoId,
      nomeCliente: ficha.nomeCliente,
      areaDireito,
      valorContratado,
      valorRecebido,
      valorPendenteOuAtrasado,
      realizationRate: valorContratado > 0 ? valorRecebido / valorContratado : null,
    });
  }

  porCaso.sort((a, b) => b.valorContratado - a.valorContratado);

  const porAreaMap = new Map<string, LinhaRelatorioPorArea>();
  for (const linha of porCaso) {
    const existente = porAreaMap.get(linha.areaDireito);
    if (existente) {
      existente.totalCasos += 1;
      existente.valorContratado += linha.valorContratado;
      existente.valorRecebido += linha.valorRecebido;
    } else {
      porAreaMap.set(linha.areaDireito, {
        areaDireito: linha.areaDireito,
        totalCasos: 1,
        valorContratado: linha.valorContratado,
        valorRecebido: linha.valorRecebido,
        realizationRate: null,
      });
    }
  }

  const porArea = Array.from(porAreaMap.values()).map((linha) => ({
    ...linha,
    realizationRate: linha.valorContratado > 0 ? linha.valorRecebido / linha.valorContratado : null,
  }));
  porArea.sort((a, b) => b.valorContratado - a.valorContratado);

  return {
    valorContratadoTotal,
    valorRecebidoTotal,
    realizationRateGeral: valorContratadoTotal > 0 ? valorRecebidoTotal / valorContratadoTotal : null,
    porCaso,
    porArea,
    quantidadeIndeterminada,
  };
}
