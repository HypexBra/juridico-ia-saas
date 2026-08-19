import type { StatusParcelaHonorario, StatusProcessualFicha } from "@/lib/types";

/**
 * Projeção de recebíveis de honorário de êxito.
 *
 * Regra de negócio (ver `supabase/migrations/0011_status_processual_caso.sql`
 * para o porquê de `statusProcessual` existir): um contrato de êxito sem
 * parcelas geradas ainda não tem data de recebimento definida — o valor só é
 * conhecido/parcelado depois do resultado do processo (comportamento já
 * documentado em `components/app/contrato-honorario-card.tsx`). Por isso a
 * função nunca inventa uma data para esses casos; eles entram em um bucket
 * "sem data" (`aguardandoResultado`/`aguardandoParcelamento`), nunca em
 * `linhasMensais`. `linhasMensais` só existe quando há parcelas REAIS
 * (`parcelas_honorario`) — a fonte de verdade sempre que disponível,
 * independentemente do status do caso (mesmo um contrato "ganho" pode já ter
 * parcelas com vencimento agendado).
 */

export type ParcelaProjecaoInput = {
  id: string;
  valor: number;
  vencimento: string; // ISO YYYY-MM-DD
  status: StatusParcelaHonorario;
};

export type ContratoExitoProjecaoInput = {
  contratoId: string;
  nomeCliente: string;
  valorTotal: number | null;
  percentualExito: number | null;
  statusProcessual: StatusProcessualFicha;
  parcelas: ParcelaProjecaoInput[];
};

export type ItemLinhaMensal = {
  contratoId: string;
  nomeCliente: string;
  parcelaId: string;
  valor: number;
  vencimento: string;
  status: StatusParcelaHonorario;
};

export type LinhaMensal = {
  mesRef: string; // YYYY-MM
  itens: ItemLinhaMensal[];
  totalPendenteAtrasado: number;
  totalPago: number;
};

/** Item de um bucket "sem data" (caso ainda não gerou parcelas). */
export type ItemSemData = {
  contratoId: string;
  nomeCliente: string;
  /** `null` quando não há `valorTotal` ou `percentualExito` cadastrado — nunca inventamos o valor. */
  valor: number | null;
  valorTotal: number | null;
  percentualExito: number | null;
};

export type ResultadoProjecaoExito = {
  /** Recebíveis com data real (parcelas já geradas), ordenados cronologicamente. */
  linhasMensais: LinhaMensal[];
  /** Casos em andamento, sem resultado ainda — expectativa NÃO confirmada. */
  aguardandoResultado: ItemSemData[];
  /** Casos com êxito confirmado (ganho/acordo) mas sem parcelamento formal ainda. */
  aguardandoParcelamento: ItemSemData[];
  /** Casos perdidos/arquivados sem parcelas — não geram nenhuma expectativa de receita. */
  encerradosSemRecebiveis: ItemSemData[];
  /** Soma de `linhasMensais` que ainda não foi paga (pendente + atrasado). */
  totalConfirmadoAReceber: number;
  /** Soma de `aguardandoResultado` (só entradas com valor calculável). */
  totalEstimadoEmAndamento: number;
  /** Soma de `aguardandoParcelamento` (só entradas com valor calculável). */
  totalConfirmadoAguardandoParcelamento: number;
  /** Contratos sem `valorTotal`/`percentualExito` suficiente para estimar valor. */
  quantidadeIndeterminada: number;
};

const STATUS_COM_EXITO_CONFIRMADO: ReadonlySet<StatusProcessualFicha> = new Set(["ganho", "acordo"]);
const STATUS_ENCERRADO_SEM_EXITO: ReadonlySet<StatusProcessualFicha> = new Set(["perdido", "arquivado"]);

/** `valorTotal * percentualExito / 100`, ou `null` se algum dos dois estiver ausente — nunca assume um valor. */
function calcularValorEstimado(valorTotal: number | null, percentualExito: number | null): number | null {
  if (valorTotal === null || percentualExito === null) return null;
  return Math.round(valorTotal * (percentualExito / 100) * 100) / 100;
}

function paraItemSemData(contrato: ContratoExitoProjecaoInput): ItemSemData {
  return {
    contratoId: contrato.contratoId,
    nomeCliente: contrato.nomeCliente,
    valor: calcularValorEstimado(contrato.valorTotal, contrato.percentualExito),
    valorTotal: contrato.valorTotal,
    percentualExito: contrato.percentualExito,
  };
}

function somarValores(itens: ItemSemData[]): number {
  return itens.reduce((soma, item) => soma + (item.valor ?? 0), 0);
}

export function calcularProjecaoExito(contratos: ContratoExitoProjecaoInput[]): ResultadoProjecaoExito {
  const linhasPorMes = new Map<string, LinhaMensal>();
  const aguardandoResultado: ItemSemData[] = [];
  const aguardandoParcelamento: ItemSemData[] = [];
  const encerradosSemRecebiveis: ItemSemData[] = [];
  let quantidadeIndeterminada = 0;

  for (const contrato of contratos) {
    if (contrato.parcelas.length > 0) {
      for (const parcela of contrato.parcelas) {
        const mesRef = parcela.vencimento.slice(0, 7);
        let linha = linhasPorMes.get(mesRef);
        if (!linha) {
          linha = { mesRef, itens: [], totalPendenteAtrasado: 0, totalPago: 0 };
          linhasPorMes.set(mesRef, linha);
        }
        linha.itens.push({
          contratoId: contrato.contratoId,
          nomeCliente: contrato.nomeCliente,
          parcelaId: parcela.id,
          valor: parcela.valor,
          vencimento: parcela.vencimento,
          status: parcela.status,
        });
        if (parcela.status === "pago") {
          linha.totalPago += parcela.valor;
        } else {
          linha.totalPendenteAtrasado += parcela.valor;
        }
      }
      continue;
    }

    // Sem parcelas geradas: bucket depende do andamento do caso vinculado.
    const item = paraItemSemData(contrato);
    if (item.valor === null) quantidadeIndeterminada += 1;

    if (STATUS_ENCERRADO_SEM_EXITO.has(contrato.statusProcessual)) {
      encerradosSemRecebiveis.push(item);
    } else if (STATUS_COM_EXITO_CONFIRMADO.has(contrato.statusProcessual)) {
      aguardandoParcelamento.push(item);
    } else {
      aguardandoResultado.push(item);
    }
  }

  const linhasMensais = Array.from(linhasPorMes.values()).sort((a, b) => a.mesRef.localeCompare(b.mesRef));
  const totalConfirmadoAReceber = linhasMensais.reduce((soma, linha) => soma + linha.totalPendenteAtrasado, 0);

  return {
    linhasMensais,
    aguardandoResultado,
    aguardandoParcelamento,
    encerradosSemRecebiveis,
    totalConfirmadoAReceber,
    totalEstimadoEmAndamento: somarValores(aguardandoResultado),
    totalConfirmadoAguardandoParcelamento: somarValores(aguardandoParcelamento),
    quantidadeIndeterminada,
  };
}
