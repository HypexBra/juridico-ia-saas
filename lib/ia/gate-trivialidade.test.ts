import { describe, it, expect } from "vitest";
import { mensagemTrivial, PALAVRAS_JURIDICAS } from "./gate-trivialidade";

describe("mensagemTrivial", () => {
  it("classifica saudações curtas como triviais", () => {
    for (const texto of ["oi", "Olá!", "bom dia", "Boa tarde, tudo bem?", "ok", "obrigado", "valeu"]) {
      expect(mensagemTrivial(texto)).toBe(true);
    }
  });

  it("classifica confirmações curtas como triviais", () => {
    for (const texto of ["entendi", "combinado", "perfeito, pode seguir", "continua", "sim"]) {
      expect(mensagemTrivial(texto)).toBe(true);
    }
  });

  it("NÃO classifica pergunta jurídica curta como trivial (palavra-chave presente)", () => {
    for (const texto of ["oi, qual o prazo de prescrição?", "olá, analise essa sentença", "bom dia, gere uma contestação"]) {
      expect(mensagemTrivial(texto)).toBe(false);
    }
  });

  it("NÃO classifica texto longo como trivial mesmo sem palavra-chave óbvia", () => {
    const texto =
      "Ontem recebi uma ligação do cliente falando sobre o andamento e pedindo atualização do caso dele com urgência.";
    expect(mensagemTrivial(texto)).toBe(false);
  });

  it("NÃO classifica mensagens com número de processo como triviais", () => {
    expect(mensagemTrivial("oi 0001234-56.2024.8.26.0100")).toBe(false);
  });

  it("trata string vazia como trivial (nada a fazer)", () => {
    expect(mensagemTrivial("")).toBe(true);
  });
});

describe("PALAVRAS_JURIDICAS", () => {
  it("cobre as áreas mais comuns do dia a dia forense", () => {
    const regex = PALAVRAS_JURIDICAS;
    for (const termo of ["processo", "petição", "sentença", "prazo", "audiência", "contrato", "jurisprudência"]) {
      expect(regex.test(termo)).toBe(true);
    }
  });

  it("não dispara com palavras genéricas do cotidiano (evita falso positivo)", () => {
    // "autor"/"civil" etc. aparecem em conversa comum; o gate é conservador
    // justamente para não tratar mensagem real como trivial por engano.
    for (const termo of ["autor do e-mail", "oi"]) {
      expect(PALAVRAS_JURIDICAS.test(termo)).toBe(false);
    }
  });
});
