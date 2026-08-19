import { describe, expect, it } from "vitest";
import { calcularResumoFinanceiro, type ParcelaResumoInput } from "./resumo";

const MES_REF = "2026-08";

function parcela(overrides: Partial<ParcelaResumoInput>): ParcelaResumoInput {
  return {
    valor: 1000,
    vencimento: "2026-08-10",
    status: "pendente",
    pago_em: null,
    ...overrides,
  };
}

describe("calcularResumoFinanceiro", () => {
  it("soma apenas parcelas pagas no mês de referência como recebido", () => {
    const parcelas: ParcelaResumoInput[] = [
      parcela({ valor: 500, status: "pago", pago_em: "2026-08-05" }),
      parcela({ valor: 300, status: "pago", pago_em: "2026-07-20" }), // mês diferente, não conta
      parcela({ valor: 200, status: "pendente" }),
    ];

    const resumo = calcularResumoFinanceiro(parcelas, MES_REF);

    expect(resumo.recebidoNoMes).toBe(500);
  });

  it("soma parcelas pendentes/atrasadas com vencimento no mês de referência como a receber", () => {
    const parcelas: ParcelaResumoInput[] = [
      parcela({ valor: 400, status: "pendente", vencimento: "2026-08-15" }),
      parcela({ valor: 150, status: "atrasado", vencimento: "2026-08-01" }),
      parcela({ valor: 999, status: "pago", pago_em: "2026-08-01" }), // paga não entra em "a receber"
      parcela({ valor: 700, status: "pendente", vencimento: "2026-09-01" }), // mês diferente
    ];

    const resumo = calcularResumoFinanceiro(parcelas, MES_REF);

    expect(resumo.aReceberNoMes).toBe(550);
  });

  it("soma o total atrasado e a contagem independente do mês de referência", () => {
    const parcelas: ParcelaResumoInput[] = [
      parcela({ valor: 300, status: "atrasado", vencimento: "2026-06-01" }),
      parcela({ valor: 200, status: "atrasado", vencimento: "2026-08-01" }),
      parcela({ valor: 100, status: "pendente", vencimento: "2026-08-01" }),
    ];

    const resumo = calcularResumoFinanceiro(parcelas, MES_REF);

    expect(resumo.totalAtrasado).toBe(500);
    expect(resumo.parcelasAtrasadasCount).toBe(2);
  });

  it("retorna zeros quando não há parcelas", () => {
    const resumo = calcularResumoFinanceiro([], MES_REF);

    expect(resumo).toEqual({
      recebidoNoMes: 0,
      aReceberNoMes: 0,
      totalAtrasado: 0,
      parcelasAtrasadasCount: 0,
    });
  });

  it("usa o mês atual como referência padrão quando não informado", () => {
    const hoje = new Date().toISOString().slice(0, 7);
    const parcelas: ParcelaResumoInput[] = [parcela({ valor: 42, status: "pago", pago_em: `${hoje}-01` })];

    const resumo = calcularResumoFinanceiro(parcelas);

    expect(resumo.recebidoNoMes).toBe(42);
  });
});
