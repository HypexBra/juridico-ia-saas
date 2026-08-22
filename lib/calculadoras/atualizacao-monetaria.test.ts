import { describe, it, expect } from "vitest";
import { calcularAtualizacaoMonetaria, anualParaMensal } from "./atualizacao-monetaria";

const serie = [
  { anoMes: "2025-12", variacaoPercentual: 0.5 },
  { anoMes: "2026-01", variacaoPercentual: 0.3 },
  { anoMes: "2026-02", variacaoPercentual: 0.2 },
];

describe("calcularAtualizacaoMonetaria", () => {
  const base = {
    valorOriginal: 10_000,
    dataInicial: "2025-11-30",
    dataFinal: "2026-03-01",
    serieIndice: serie,
    taxaJurosMensalPercentual: 1,
    tipoJuros: "simples" as const,
  };

  it("compõe os fatores dos índices do período e corrige o principal", () => {
    const r = calcularAtualizacaoMonetaria(base);
    // fator = 1.005 × 1.003 × 1.002 ≈ 1.01006...
    expect(r.valorCorrigido).toBeCloseTo(10_000 * (1.005 * 1.003 * 1.002), 0);
    expect(r.mesesCorrigidos).toBe(3);
    expect(r.demonstrativo).toHaveLength(3);
  });

  it("ignora índices fora do intervalo (antes da data inicial ou depois da final)", () => {
    const r = calcularAtualizacaoMonetaria({
      ...base,
      serieIndice: [{ anoMes: "2025-10", variacaoPercentual: 5 }, ...serie, { anoMes: "2026-05", variacaoPercentual: 7 }],
    });
    // Meses de 2025-10 e 2026-05 não entram.
    expect(r.mesesCorrigidos).toBe(3);
  });

  it("juros simples incidem sobre o principal corrigido, pro-rata por dias/30", () => {
    const r = calcularAtualizacaoMonetaria(base);
    const esperadoJuros = r.valorCorrigido * 0.01 * (r.diasJuros / 30);
    expect(r.juros).toBeCloseTo(esperadoJuros, 0);
  });

  it("juros compostos diferem dos simples com mesma taxa e período", () => {
    const simples = calcularAtualizacaoMonetaria({ ...base, tipoJuros: "simples" });
    const compostos = calcularAtualizacaoMonetaria({ ...base, tipoJuros: "compostos" });
    expect(compostos.juros).toBeGreaterThan(simples.juros);
  });

  it("multa incide sobre corrigido + juros; honorários sobre tudo", () => {
    const r = calcularAtualizacaoMonetaria({ ...base, multaPercentual: 2, honorariosPercentual: 20 });
    const baseMulta = r.valorCorrigido + r.juros;
    expect(r.multa).toBeCloseTo(baseMulta * 0.02, 0);
    expect(r.honorarios).toBeCloseTo((baseMulta + r.multa) * 0.2, 0);
    expect(r.total).toBeCloseTo(r.valorCorrigido + r.juros + r.multa + r.honorarios, 0);
  });

  it("valida entradas inválidas sem calcular silêncio", () => {
    expect(() => calcularAtualizacaoMonetaria({ ...base, valorOriginal: 0 })).toThrow();
    expect(() => calcularAtualizacaoMonetaria({ ...base, dataFinal: "2025-01-01" })).toThrow();
  });

  it("todo resultado carrega fórmulas, premissas e fontes (regra Fase 16)", () => {
    const r = calcularAtualizacaoMonetaria(base);
    expect(r.formulas.length).toBeGreaterThan(0);
    expect(r.premissas.length).toBeGreaterThan(0);
    expect(r.fontes.some((f) => f.includes("14.905"))).toBe(true);
  });
});

describe("anualParaMensal", () => {
  it("converte taxa composta anual em mensal equivalente", () => {
    // 100% a.a. ≈ 5,95% a.m. (1.0595^12 ≈ 2)
    expect(anualParaMensal(100)).toBeCloseTo(5.946, 2);
    expect(Math.pow(1 + anualParaMensal(100) / 100, 12)).toBeCloseTo(2, 4);
  });
});
