import { describe, it, expect } from "vitest";
import {
  feriadosNacionais,
  pascoa,
  calcularPrazoProcessual,
  contarDiasUteis,
} from "./dias-uteis";

describe("pascoa", () => {
  it("calcula datas conhecidas da Páscoa", () => {
    expect(pascoa(2026)).toEqual({ mes: 4, dia: 5 });
    expect(pascoa(2024)).toEqual({ mes: 3, dia: 31 });
    expect(pascoa(2027)).toEqual({ mes: 3, dia: 28 });
  });
});

describe("feriadosNacionais", () => {
  it("inclui fixos, móveis e Consciência Negra (Lei 14.759/2023)", () => {
    const feriados2026 = feriadosNacionais(2026);
    const datas = new Map(feriados2026.map((f) => [f.nome, f.data]));
    expect(datas.get("Tiradentes")).toBe("2026-04-21");
    expect(datas.get("Consciência Negra (Lei 14.759/2023)")).toBe("2026-11-20");
    // Páscoa 05/04/2026: segunda carnaval (-48) = 16/02, terça (-47) = 17/02,
    // Corpus Christi (+60) = 04/06/2026.
    expect(datas.get("Segunda-feira de Carnaval (ponto facultativo nacional)")).toBe("2026-02-16");
    expect(datas.get("Terça-feira de Carnaval")).toBe("2026-02-17");
    expect(datas.get("Corpus Christi")).toBe("2026-06-04");
  });
});

describe("calcularPrazoProcessual", () => {
  it("prazo de 15 dias úteis: início no primeiro útil após publicação e vencimento deslocado se não útil", () => {
    const resultado = calcularPrazoProcessual({
      dataPublicacao: "2026-03-02", // segunda-feira
      dias: 15,
    });
    // Início: terça 03/03 (primeiro útil após a publicação).
    expect(resultado.inicioContagem).toBe("2026-03-03");
    // 15 dias úteis a partir de 04/03 (excluindo o dia do começo) → 24/03/2026 (terça).
    expect(resultado.vencimento).toBe("2026-03-24");
    expect(resultado.diasUteisEfetivos).toBe(15);
    expect(resultado.premissas.some((p) => p.includes("dias úteis"))).toBe(true);
  });

  it("publicação na sexta: começa a contar na segunda", () => {
    const resultado = calcularPrazoProcessual({ dataPublicacao: "2026-08-21", dias: 5 });
    expect(resultado.inicioContagem).toBe("2026-08-24"); // segunda
  });

  it("prazo em dobro dobra os dias úteis", () => {
    const simples = calcularPrazoProcessual({ dataPublicacao: "2026-03-02", dias: 10 });
    const dobrado = calcularPrazoProcessual({ dataPublicacao: "2026-03-02", dias: 10, emDobro: true });
    expect(dobrado.vencimento > simples.vencimento).toBe(true);
    expect(dobrado.premissas.some((p) => p.includes("DOBRO"))).toBe(true);
  });

  it("prazo em meses usa contagem contínua e desliza quando vence em feriado", () => {
    const resultado = calcularPrazoProcessual({ dataPublicacao: "2026-01-15", meses: 1 });
    // início 16/01 (sexta) → +1 mês = 16/02/2026, que é SEGUNDA DE CARNAVAL
    // (Páscoa 05/04 → segunda -48 = 16/02); desliza pelo art. 224 §1º até o
    // próximo dia útil: 18/02/2026 (quarta).
    expect(resultado.vencimento).toBe("2026-02-18");
  });

  it("lança erro sem nenhum prazo informado", () => {
    expect(() => calcularPrazoProcessual({ dataPublicacao: "2026-01-15" })).toThrow();
  });
});

describe("contarDiasUteis", () => {
  it("conta úteis EXCLUINDO o dia de começo e INCLUINDO o de fim (padrão processual)", () => {
    // Segunda 09/11/2026 → sexta 13/11/2026: conta 10,11,12,13 = 4.
    expect(contarDiasUteis("2026-11-09", "2026-11-13")).toBe(4);
    // Semana com feriado de 20/11 (sexta): 16/11 a 20/11 = 17,18,19 = 3.
    expect(contarDiasUteis("2026-11-16", "2026-11-20")).toBe(3);
  });
});
