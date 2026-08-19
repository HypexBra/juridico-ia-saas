import { describe, expect, it } from "vitest";
import { montarPromptPeca } from "./prompt";

const FICHA_BASE = {
  nomeCliente: "Maria Souza",
  areaDireito: "Trabalhista",
  resumoFatos: "Cliente foi demitida sem justa causa e não recebeu verbas rescisórias.",
  urgencia: "normal" as const,
  numeroProcessoCnj: null,
  valorCausa: null,
};

describe("montarPromptPeca", () => {
  it("inclui o rótulo legível do tipo de peça e os dados da ficha", () => {
    const prompt = montarPromptPeca({ tipoPeca: "peticao_inicial", ficha: FICHA_BASE, instrucoesExtras: null });

    expect(prompt).toContain("Petição inicial");
    expect(prompt).toContain("Maria Souza");
    expect(prompt).toContain("Trabalhista");
    expect(prompt).toContain("demitida sem justa causa");
  });

  it("usa placeholders explícitos para dados ausentes, em vez de omitir ou inventar", () => {
    const prompt = montarPromptPeca({ tipoPeca: "contestacao", ficha: FICHA_BASE, instrucoesExtras: null });

    expect(prompt).toContain("não informado");
    expect(prompt).toContain("nenhuma");
  });

  it("inclui número de processo e valor da causa quando presentes, já formatados", () => {
    const prompt = montarPromptPeca({
      tipoPeca: "recurso",
      ficha: { ...FICHA_BASE, numeroProcessoCnj: "0001234-56.2026.8.26.0100", valorCausa: 15000 },
      instrucoesExtras: null,
    });

    expect(prompt).toContain("0001234-56.2026.8.26.0100");
    expect(prompt).toContain("R$");
    expect(prompt).toContain("15.000,00");
  });

  it("inclui instruções extras do advogado quando fornecidas", () => {
    const prompt = montarPromptPeca({
      tipoPeca: "parecer",
      ficha: FICHA_BASE,
      instrucoesExtras: "Focar em dano moral e pedir tutela de urgência.",
    });

    expect(prompt).toContain("Focar em dano moral e pedir tutela de urgência.");
  });

  it("ignora instruções extras em branco (trata como nenhuma)", () => {
    const prompt = montarPromptPeca({ tipoPeca: "parecer", ficha: FICHA_BASE, instrucoesExtras: "   " });

    expect(prompt).toContain("Instruções extras do advogado: nenhuma");
  });

  it("delimita claramente o bloco de dados do caso, isolando-o das instruções de sistema", () => {
    const prompt = montarPromptPeca({ tipoPeca: "peticao_inicial", ficha: FICHA_BASE, instrucoesExtras: null });

    expect(prompt).toContain("===INÍCIO DOS DADOS DO CASO===");
    expect(prompt).toContain("===FIM DOS DADOS DO CASO===");
    const inicio = prompt.indexOf("===INÍCIO DOS DADOS DO CASO===");
    const fim = prompt.indexOf("===FIM DOS DADOS DO CASO===");
    expect(inicio).toBeLessThan(fim);
  });
});
