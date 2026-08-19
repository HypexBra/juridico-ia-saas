import { describe, expect, it } from "vitest";
import { calcularProjecaoExito, type ContratoExitoProjecaoInput } from "@/lib/financeiro/projecao-exito";

function contrato(overrides: Partial<ContratoExitoProjecaoInput>): ContratoExitoProjecaoInput {
  return {
    contratoId: "contrato-1",
    nomeCliente: "Cliente Teste",
    valorTotal: null,
    percentualExito: null,
    statusProcessual: "em_andamento",
    parcelas: [],
    ...overrides,
  };
}

describe("calcularProjecaoExito", () => {
  it("agrupa parcelas já geradas por mês de vencimento, somando só o que ainda não foi pago", () => {
    const resultado = calcularProjecaoExito([
      contrato({
        contratoId: "c1",
        parcelas: [
          { id: "p1", valor: 1000, vencimento: "2026-09-10", status: "pendente" },
          { id: "p2", valor: 500, vencimento: "2026-09-20", status: "pago" },
          { id: "p3", valor: 2000, vencimento: "2026-10-05", status: "atrasado" },
        ],
      }),
    ]);

    expect(resultado.linhasMensais).toHaveLength(2);
    expect(resultado.linhasMensais[0]).toMatchObject({
      mesRef: "2026-09",
      totalPendenteAtrasado: 1000,
      totalPago: 500,
    });
    expect(resultado.linhasMensais[1]).toMatchObject({
      mesRef: "2026-10",
      totalPendenteAtrasado: 2000,
      totalPago: 0,
    });
    expect(resultado.totalConfirmadoAReceber).toBe(3000);
  });

  it("ordena as linhas mensais cronologicamente independente da ordem de entrada", () => {
    const resultado = calcularProjecaoExito([
      contrato({
        contratoId: "c1",
        parcelas: [
          { id: "p1", valor: 100, vencimento: "2027-01-10", status: "pendente" },
          { id: "p2", valor: 200, vencimento: "2026-06-10", status: "pendente" },
        ],
      }),
    ]);

    expect(resultado.linhasMensais.map((linha) => linha.mesRef)).toEqual(["2026-06", "2027-01"]);
  });

  it("caso em andamento sem parcelas entra como estimativa (não confirmada) quando há valor total e percentual", () => {
    const resultado = calcularProjecaoExito([
      contrato({
        contratoId: "c1",
        statusProcessual: "em_andamento",
        valorTotal: 100_000,
        percentualExito: 20,
      }),
    ]);

    expect(resultado.linhasMensais).toHaveLength(0);
    expect(resultado.aguardandoResultado).toHaveLength(1);
    expect(resultado.aguardandoResultado[0]).toMatchObject({ contratoId: "c1", valor: 20_000 });
    expect(resultado.totalEstimadoEmAndamento).toBe(20_000);
    expect(resultado.quantidadeIndeterminada).toBe(0);
  });

  it("caso em andamento sem valor total definido é indeterminado, não inventa valor", () => {
    const resultado = calcularProjecaoExito([
      contrato({ contratoId: "c1", statusProcessual: "em_andamento", percentualExito: 30, valorTotal: null }),
    ]);

    expect(resultado.aguardandoResultado[0]?.valor).toBeNull();
    expect(resultado.totalEstimadoEmAndamento).toBe(0);
    expect(resultado.quantidadeIndeterminada).toBe(1);
  });

  it("caso ganho/acordo sem parcelas geradas ainda entra como confirmado aguardando parcelamento", () => {
    const ganho = calcularProjecaoExito([
      contrato({ contratoId: "c1", statusProcessual: "ganho", valorTotal: 50_000, percentualExito: 25 }),
    ]);
    const acordo = calcularProjecaoExito([
      contrato({ contratoId: "c2", statusProcessual: "acordo", valorTotal: 80_000, percentualExito: 10 }),
    ]);

    expect(ganho.aguardandoParcelamento).toHaveLength(1);
    expect(ganho.aguardandoParcelamento[0]).toMatchObject({ contratoId: "c1", valor: 12_500 });
    expect(ganho.totalConfirmadoAguardandoParcelamento).toBe(12_500);

    expect(acordo.aguardandoParcelamento).toHaveLength(1);
    expect(acordo.totalConfirmadoAguardandoParcelamento).toBe(8_000);
  });

  it("caso perdido/arquivado sem parcelas não gera expectativa de receita", () => {
    const resultado = calcularProjecaoExito([
      contrato({ contratoId: "c1", statusProcessual: "perdido", valorTotal: 60_000, percentualExito: 30 }),
      contrato({ contratoId: "c2", statusProcessual: "arquivado", valorTotal: 40_000, percentualExito: 10 }),
    ]);

    expect(resultado.encerradosSemRecebiveis).toHaveLength(2);
    expect(resultado.totalConfirmadoAReceber).toBe(0);
    expect(resultado.totalEstimadoEmAndamento).toBe(0);
    expect(resultado.totalConfirmadoAguardandoParcelamento).toBe(0);
  });

  it("contrato de êxito sem percentual cadastrado (dado incompleto) não quebra e vira indeterminado", () => {
    const resultado = calcularProjecaoExito([
      contrato({ contratoId: "c1", statusProcessual: "em_andamento", valorTotal: 10_000, percentualExito: null }),
    ]);

    expect(resultado.aguardandoResultado[0]?.valor).toBeNull();
    expect(resultado.quantidadeIndeterminada).toBe(1);
  });

  it("caso ganho COM parcelas já geradas usa as parcelas (fonte real), não a estimativa", () => {
    const resultado = calcularProjecaoExito([
      contrato({
        contratoId: "c1",
        statusProcessual: "ganho",
        valorTotal: 100_000,
        percentualExito: 30,
        parcelas: [{ id: "p1", valor: 30_000, vencimento: "2026-11-01", status: "pendente" }],
      }),
    ]);

    expect(resultado.aguardandoParcelamento).toHaveLength(0);
    expect(resultado.linhasMensais).toHaveLength(1);
    expect(resultado.totalConfirmadoAReceber).toBe(30_000);
  });

  it("soma múltiplos contratos no mesmo mês corretamente", () => {
    const resultado = calcularProjecaoExito([
      contrato({
        contratoId: "c1",
        parcelas: [{ id: "p1", valor: 1000, vencimento: "2026-09-15", status: "pendente" }],
      }),
      contrato({
        contratoId: "c2",
        parcelas: [{ id: "p2", valor: 2500, vencimento: "2026-09-01", status: "atrasado" }],
      }),
    ]);

    expect(resultado.linhasMensais).toHaveLength(1);
    expect(resultado.linhasMensais[0]?.totalPendenteAtrasado).toBe(3500);
    expect(resultado.linhasMensais[0]?.itens).toHaveLength(2);
  });

  it("lista vazia retorna estrutura vazia sem lançar erro", () => {
    const resultado = calcularProjecaoExito([]);
    expect(resultado.linhasMensais).toEqual([]);
    expect(resultado.aguardandoResultado).toEqual([]);
    expect(resultado.aguardandoParcelamento).toEqual([]);
    expect(resultado.encerradosSemRecebiveis).toEqual([]);
    expect(resultado.totalConfirmadoAReceber).toBe(0);
    expect(resultado.totalEstimadoEmAndamento).toBe(0);
    expect(resultado.totalConfirmadoAguardandoParcelamento).toBe(0);
    expect(resultado.quantidadeIndeterminada).toBe(0);
  });
});
