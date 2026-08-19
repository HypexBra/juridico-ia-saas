import { describe, expect, it } from "vitest";
import {
  calcularRelatorioAvancado,
  type ContratoParaRelatorioAvancado,
  type FichaParaRelatorioAvancado,
  type ParcelaParaRelatorioAvancado,
} from "./avancado";

function ficha(overrides: Partial<FichaParaRelatorioAvancado>): FichaParaRelatorioAvancado {
  return {
    id: "ficha-1",
    nomeCliente: "Cliente Padrão",
    areaDireito: "Trabalhista",
    ...overrides,
  };
}

function contrato(overrides: Partial<ContratoParaRelatorioAvancado>): ContratoParaRelatorioAvancado {
  return {
    contratoId: "contrato-1",
    fichaCasoId: "ficha-1",
    valorTotal: 10_000,
    ...overrides,
  };
}

function parcela(overrides: Partial<ParcelaParaRelatorioAvancado>): ParcelaParaRelatorioAvancado {
  return {
    contratoId: "contrato-1",
    valor: 1000,
    status: "pendente",
    ...overrides,
  };
}

describe("calcularRelatorioAvancado", () => {
  it("retorna estrutura zerada/nula quando não há contratos", () => {
    const resultado = calcularRelatorioAvancado([], [], []);

    expect(resultado.valorContratadoTotal).toBe(0);
    expect(resultado.valorRecebidoTotal).toBe(0);
    expect(resultado.realizationRateGeral).toBeNull();
    expect(resultado.porCaso).toEqual([]);
    expect(resultado.porArea).toEqual([]);
    expect(resultado.quantidadeIndeterminada).toBe(0);
  });

  it("calcula a realization rate geral como recebido / contratado", () => {
    const fichas = [ficha({ id: "f1" })];
    const contratos = [contrato({ contratoId: "c1", fichaCasoId: "f1", valorTotal: 10_000 })];
    const parcelas = [
      parcela({ contratoId: "c1", valor: 4_000, status: "pago" }),
      parcela({ contratoId: "c1", valor: 3_000, status: "pendente" }),
    ];

    const resultado = calcularRelatorioAvancado(fichas, contratos, parcelas);

    expect(resultado.valorContratadoTotal).toBe(10_000);
    expect(resultado.valorRecebidoTotal).toBe(4_000);
    expect(resultado.realizationRateGeral).toBeCloseTo(0.4);
  });

  it("agrega o breakdown financeiro por caso, incluindo pendente/atrasado", () => {
    const fichas = [ficha({ id: "f1", nomeCliente: "Ana", areaDireito: "Cível" })];
    const contratos = [contrato({ contratoId: "c1", fichaCasoId: "f1", valorTotal: 5_000 })];
    const parcelas = [
      parcela({ contratoId: "c1", valor: 2_000, status: "pago" }),
      parcela({ contratoId: "c1", valor: 1_500, status: "pendente" }),
      parcela({ contratoId: "c1", valor: 500, status: "atrasado" }),
    ];

    const resultado = calcularRelatorioAvancado(fichas, contratos, parcelas);

    expect(resultado.porCaso).toHaveLength(1);
    expect(resultado.porCaso[0]).toMatchObject({
      fichaCasoId: "f1",
      nomeCliente: "Ana",
      areaDireito: "Cível",
      valorContratado: 5_000,
      valorRecebido: 2_000,
      valorPendenteOuAtrasado: 2_000,
    });
    expect(resultado.porCaso[0]?.realizationRate).toBeCloseTo(0.4);
  });

  it("agrega o breakdown financeiro por área do direito somando múltiplos casos", () => {
    const fichas = [
      ficha({ id: "f1", nomeCliente: "Ana", areaDireito: "Trabalhista" }),
      ficha({ id: "f2", nomeCliente: "Bruno", areaDireito: "Trabalhista" }),
      ficha({ id: "f3", nomeCliente: "Carla", areaDireito: "Cível" }),
    ];
    const contratos = [
      contrato({ contratoId: "c1", fichaCasoId: "f1", valorTotal: 4_000 }),
      contrato({ contratoId: "c2", fichaCasoId: "f2", valorTotal: 6_000 }),
      contrato({ contratoId: "c3", fichaCasoId: "f3", valorTotal: 2_000 }),
    ];
    const parcelas = [
      parcela({ contratoId: "c1", valor: 4_000, status: "pago" }),
      parcela({ contratoId: "c2", valor: 3_000, status: "pago" }),
      parcela({ contratoId: "c3", valor: 2_000, status: "pendente" }),
    ];

    const resultado = calcularRelatorioAvancado(fichas, contratos, parcelas);

    const trabalhista = resultado.porArea.find((linha) => linha.areaDireito === "Trabalhista");
    const civel = resultado.porArea.find((linha) => linha.areaDireito === "Cível");

    expect(trabalhista).toMatchObject({
      areaDireito: "Trabalhista",
      totalCasos: 2,
      valorContratado: 10_000,
      valorRecebido: 7_000,
    });
    expect(trabalhista?.realizationRate).toBeCloseTo(0.7);

    expect(civel).toMatchObject({
      areaDireito: "Cível",
      totalCasos: 1,
      valorContratado: 2_000,
      valorRecebido: 0,
    });
    expect(civel?.realizationRate).toBeCloseTo(0);
  });

  it("usa o rótulo 'Não informada' para fichas sem área do direito cadastrada", () => {
    const fichas = [ficha({ id: "f1", areaDireito: null })];
    const contratos = [contrato({ contratoId: "c1", fichaCasoId: "f1", valorTotal: 1_000 })];
    const parcelas = [parcela({ contratoId: "c1", valor: 1_000, status: "pago" })];

    const resultado = calcularRelatorioAvancado(fichas, contratos, parcelas);

    expect(resultado.porArea).toHaveLength(1);
    expect(resultado.porArea[0]?.areaDireito).toBe("Não informada");
    expect(resultado.porCaso[0]?.areaDireito).toBe("Não informada");
  });

  it("nunca inventa valorContratado: contratos sem valor_total ficam fora do cálculo de rate e contam em quantidadeIndeterminada", () => {
    const fichas = [ficha({ id: "f1" }), ficha({ id: "f2", nomeCliente: "Outro" })];
    const contratos = [
      contrato({ contratoId: "c1", fichaCasoId: "f1", valorTotal: 1_000 }),
      contrato({ contratoId: "c2", fichaCasoId: "f2", valorTotal: null }),
    ];
    const parcelas = [
      parcela({ contratoId: "c1", valor: 1_000, status: "pago" }),
      parcela({ contratoId: "c2", valor: 500, status: "pago" }),
    ];

    const resultado = calcularRelatorioAvancado(fichas, contratos, parcelas);

    expect(resultado.valorContratadoTotal).toBe(1_000);
    expect(resultado.valorRecebidoTotal).toBe(1_000);
    expect(resultado.quantidadeIndeterminada).toBe(1);
    const casoIndeterminado = resultado.porCaso.find((linha) => linha.fichaCasoId === "f2");
    expect(casoIndeterminado?.realizationRate).toBeNull();
    expect(casoIndeterminado?.valorContratado).toBe(0);
  });

  it("ignora contratos cuja ficha_caso_id não corresponde a nenhuma ficha carregada (dados órfãos)", () => {
    const fichas = [ficha({ id: "f1" })];
    const contratos = [
      contrato({ contratoId: "c1", fichaCasoId: "f1", valorTotal: 1_000 }),
      contrato({ contratoId: "c-orfao", fichaCasoId: "ficha-inexistente", valorTotal: 500 }),
    ];
    const parcelas = [parcela({ contratoId: "c1", valor: 1_000, status: "pago" })];

    const resultado = calcularRelatorioAvancado(fichas, contratos, parcelas);

    expect(resultado.porCaso).toHaveLength(1);
    expect(resultado.valorContratadoTotal).toBe(1_000);
  });

  it("ordena porCaso e porArea por valorContratado decrescente", () => {
    const fichas = [
      ficha({ id: "f1", nomeCliente: "Pequeno", areaDireito: "Tributário" }),
      ficha({ id: "f2", nomeCliente: "Grande", areaDireito: "Empresarial" }),
    ];
    const contratos = [
      contrato({ contratoId: "c1", fichaCasoId: "f1", valorTotal: 1_000 }),
      contrato({ contratoId: "c2", fichaCasoId: "f2", valorTotal: 9_000 }),
    ];
    const parcelas: ParcelaParaRelatorioAvancado[] = [];

    const resultado = calcularRelatorioAvancado(fichas, contratos, parcelas);

    expect(resultado.porCaso.map((linha) => linha.fichaCasoId)).toEqual(["f2", "f1"]);
    expect(resultado.porArea.map((linha) => linha.areaDireito)).toEqual(["Empresarial", "Tributário"]);
  });
});
