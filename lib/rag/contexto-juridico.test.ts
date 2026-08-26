import { describe, expect, it } from "vitest";
import { recortarConsultaRag, TAMANHO_MAXIMO_CONSULTA_RAG } from "./contexto-juridico";

describe("recortarConsultaRag", () => {
  it("normaliza espaços e quebras de linha", () => {
    expect(recortarConsultaRag("  prescrição \n\n  quinquenal \t contra a Fazenda  ")).toBe(
      "prescrição quinquenal contra a Fazenda",
    );
  });

  it("devolve o texto inteiro quando cabe no limite", () => {
    const texto = "usucapião extraordinária";
    expect(recortarConsultaRag(texto)).toBe(texto);
  });

  it("respeita o teto de caracteres", () => {
    const recortado = recortarConsultaRag("palavra ".repeat(1000));
    expect(recortado.length).toBeLessThanOrEqual(TAMANHO_MAXIMO_CONSULTA_RAG);
  });

  it("corta em fronteira de palavra, não no meio de um termo", () => {
    // Teto 35 cairia dentro do quarto "usucapiao"; recua para o espaço em 29,
    // perda de 6 chars (dentro da margem de 20% que a função aceita recuar).
    const recortado = recortarConsultaRag("usucapiao ".repeat(500), 35);
    expect(recortado).toBe("usucapiao usucapiao usucapiao");
  });

  it("corta duro no teto quando recuar custaria mais que 20% da consulta", () => {
    // Guarda contra o caso patológico: com teto 25 o último espaço está em
    // 19, e recuar até lá jogaria fora quase um quarto do sinal. Aceita
    // terminar num termo parcial · o embedding lida melhor com uma palavra
    // truncada no fim do que com uma consulta 24% menor.
    expect(recortarConsultaRag("usucapiao ".repeat(500), 25)).toBe("usucapiao usucapiao usuca");
  });

  it("aceita corte no meio quando não há espaço nenhum", () => {
    expect(recortarConsultaRag("a".repeat(100), 10)).toBe("a".repeat(10));
  });

  it("devolve string vazia para entrada só de espaços", () => {
    expect(recortarConsultaRag("   \n  ")).toBe("");
  });
});
