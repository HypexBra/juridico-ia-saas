import { describe, expect, it } from "vitest";
import { decomporConsulta } from "./multi-consulta";

describe("decomporConsulta", () => {
  it("devolve a pergunta original quando não há sinal de múltiplas questões", () => {
    expect(decomporConsulta("Qual o prazo para contestação no rito ordinário?")).toEqual([
      "Qual o prazo para contestação no rito ordinário?",
    ]);
  });

  it("divide por múltiplas interrogações", () => {
    const r = decomporConsulta("Qual o prazo para contestação? E qual o prazo para réplica?");
    expect(r).toEqual(["Qual o prazo para contestação?", "E qual o prazo para réplica?"]);
  });

  it("divide por conectivo de coordenação quando as cláusulas são longas o suficiente", () => {
    const r = decomporConsulta(
      "explique o instituto da prescrição intercorrente no processo civil brasileiro; e explique também a diferença dela para a decadência",
    );
    expect(r.length).toBe(2);
  });

  it("não fatia um substantivo composto curto em falsas sub-consultas", () => {
    expect(decomporConsulta("O que é acordo e distrato?")).toEqual(["O que é acordo e distrato?"]);
  });

  it("string vazia não quebra", () => {
    expect(decomporConsulta("")).toEqual([""]);
  });

  it("nunca devolve mais que 3 sub-consultas", () => {
    const pergunta = "Uma pergunta bem longa aqui? Outra pergunta também longa aqui? Mais uma pergunta longa aqui? E ainda mais uma pergunta longa aqui?";
    expect(decomporConsulta(pergunta).length).toBeLessThanOrEqual(3);
  });
});
