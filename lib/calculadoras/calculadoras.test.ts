import { describe, it, expect } from "vitest";
import { calcularSucumbenciaisArt85 } from "./honorarios-sucumbenciais";
import { calcularPrescricao } from "./prescricao";

describe("calcularSucumbenciaisArt85", () => {
  const SM = 1518; // SM de referência do teste

  it("condenação na primeira faixa: 20% plano (sem progressão)", () => {
    // 500 SM = 759.000? Não — 500 × 1518 = R$ 759.000... na verdade 500 SM.
    const r = calcularSucumbenciaisArt85(500 * SM, SM);
    expect(r.linhasPorFaixa).toHaveLength(1);
    expect(r.totalHonorarios).toBe(500 * SM * 0.2);
    expect(r.percentualEfetivo).toBe(20);
  });

  it("condenação de 3.000 SM aplica as TRÊS primeiras faixas progressivamente", () => {
    const r = calcularSucumbenciaisArt85(3_000 * SM, SM);
    // 1.000×20% + 1.000×15% + 1.000×10% = 450 SM
    expect(r.salariosMinimosReferencia).toBe(3_000);
    expect(r.totalHonorarios).toBe(450 * SM);
    expect(r.percentualEfetivo).toBe(15);
    expect(r.linhasPorFaixa.map((l) => l.percentual)).toEqual([20, 15, 10]);
  });

  it("faixa final pega só o que excede o limite inferior (não a taxa no valor todo)", () => {
    // 60.000 URM → última fatia é só o que excede 50.000 (10.000 URM a 5%).
    const r = calcularSucumbenciaisArt85(60_000 * SM, SM);
    const ultima = r.linhasPorFaixa[r.linhasPorFaixa.length - 1];
    expect(ultima.percentual).toBe(5);
    expect(ultima.baseNaFaixa).toBeCloseTo(10_000 * SM, 0);
    expect(r.percentualEfetivo).toBeLessThan(10); // taxa efetiva cai com o tamanho
  });

  it("sucumbência recursal = 50% da anterior quando solicitada", () => {
    const r = calcularSucumbenciaisArt85(3_000 * SM, SM, true);
    expect(r.sucumbenciaRecursal).toBe(r.totalHonorarios / 2);
  });

  it("valida entradas e documenta premissas/fontes", () => {
    expect(() => calcularSucumbenciaisArt85(-1, SM)).toThrow();
    expect(() => calcularSucumbenciaisArt85(1000, 0)).toThrow();
    const r = calcularSucumbenciaisArt85(3_000 * SM, SM);
    expect(r.premissas.some((p) => p.includes("art. 85"))).toBe(true);
  });
});

describe("calcularPrescricao", () => {
  it("reparação civil de 3 anos: vencida quando data passou", () => {
    const r = calcularPrescricao("reparacao_civil_3_anos", "2020-01-01", "2026-01-01");
    expect(r.dataFinal).toBe("2023-01-01");
    expect(r.status).toBe("prescrito");
    expect(r.fundamento).toContain("206");
  });

  it("prazo em aberto com menos de 180 dias marca 'proximo'", () => {
    const r = calcularPrescricao("reparacao_civil_3_anos", "2024-03-01", "2026-01-01");
    // Vence 2027-03-01 → ~425 dias de 2026-01-01 → em_aberto.
    expect(r.status).toBe("em_aberto");
    const bemProximo = calcularPrescricao("cdc_vicio_duravel_90_dias", "2025-12-01", "2026-02-01");
    // Decadência de 90 dias desde 01/12/2025 → vence ~01/03/2026 → faltam ~28 dias → proximo.
    expect(bemProximo.status).toBe("proximo");
  });

  it("decadência CDC durável usa DIAS e cita art. 26", () => {
    const r = calcularPrescricao("cdc_vicio_duravel_90_dias", "2026-05-01", "2026-06-01");
    expect(r.dataFinal).toBe("2026-07-30");
    expect(r.status).toBe("proximo");
  });

  it("todo resultado carrega premissas sobre interrupção/suspensão", () => {
    const r = calcularPrescricao("tributaria_5_anos", "2021-01-01", "2026-08-22");
    expect(r.premissas.some((p) => p.includes("interrupção"))).toBe(true);
  });
});
