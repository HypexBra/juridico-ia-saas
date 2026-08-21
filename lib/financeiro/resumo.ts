import type { ParcelaHonorario } from "@/lib/types";

/**
 * Campos de `parcelas_honorario` necessários para agregar o resumo
 * financeiro (recebido/a receber/atrasado) — subconjunto do tipo completo,
 * pra aceitar tanto o resultado de uma query flat (dashboard) quanto o
 * `flatMap` de parcelas aninhadas em contratos (app/app/financeiro/page.tsx),
 * sem duplicar a lógica de agregação por mês/status entre as duas telas.
 */
export type ParcelaResumoInput = Pick<ParcelaHonorario, "valor" | "vencimento" | "status" | "pago_em">;

export type ResumoFinanceiro = {
  /** Soma de parcelas pagas com pagamento registrado no mês de referência. */
  recebidoNoMes: number;
  /** Soma de parcelas pendentes/atrasadas com vencimento no mês de referência. */
  aReceberNoMes: number;
  /** Soma de todas as parcelas com status `atrasado`, independente do mês. */
  totalAtrasado: number;
  /** Quantidade de parcelas com status `atrasado`. */
  parcelasAtrasadasCount: number;
};

/**
 * Agrega um resumo financeiro (recebido, a receber, inadimplência) a partir
 * de uma lista de parcelas de honorário já carregadas. Função pura — quem
 * chama decide como buscar as parcelas (join com contratos, ou direto na
 * tabela) e quando rodar `sincronizarParcelasAtrasadas` antes.
 */
export function calcularResumoFinanceiro(
  parcelas: ParcelaResumoInput[],
  mesRef: string = new Date().toISOString().slice(0, 7),
): ResumoFinanceiro {
  const recebidoNoMes = parcelas
    .filter((p) => p.status === "pago" && (p.pago_em ?? "").startsWith(mesRef))
    .reduce((soma, p) => soma + p.valor, 0);

  const aReceberNoMes = parcelas
    .filter((p) => p.status !== "pago" && p.vencimento.startsWith(mesRef))
    .reduce((soma, p) => soma + p.valor, 0);

  const parcelasAtrasadas = parcelas.filter((p) => p.status === "atrasado");
  const totalAtrasado = parcelasAtrasadas.reduce((soma, p) => soma + p.valor, 0);

  return {
    recebidoNoMes,
    aReceberNoMes,
    totalAtrasado,
    parcelasAtrasadasCount: parcelasAtrasadas.length,
  };
}
