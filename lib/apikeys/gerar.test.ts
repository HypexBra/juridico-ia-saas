import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { calcularHashApiKey, gerarApiKey } from "./gerar";

describe("gerarApiKey", () => {
  it("gera chave completa no formato jia_live_<64 chars hex>", () => {
    const { chaveCompleta } = gerarApiKey();

    expect(chaveCompleta).toMatch(/^jia_live_[0-9a-f]{64}$/);
  });

  it("gera chaves diferentes a cada chamada (alta entropia, sem colisão previsível)", () => {
    const a = gerarApiKey();
    const b = gerarApiKey();

    expect(a.chaveCompleta).not.toBe(b.chaveCompleta);
    expect(a.chaveHash).not.toBe(b.chaveHash);
  });

  it("o hash retornado bate com o SHA-256 hex real da chave completa", () => {
    const { chaveCompleta, chaveHash } = gerarApiKey();

    const hashEsperado = createHash("sha256").update(chaveCompleta, "utf8").digest("hex");
    expect(chaveHash).toBe(hashEsperado);
    expect(chaveHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("o prefixo visível começa com jia_live_ e é bem mais curto que a chave completa", () => {
    const { chaveCompleta, prefixoVisivel } = gerarApiKey();

    expect(prefixoVisivel.startsWith("jia_live_")).toBe(true);
    expect(prefixoVisivel.length).toBeLessThan(chaveCompleta.length);
    expect(chaveCompleta.startsWith(prefixoVisivel)).toBe(true);
  });

  it("calcularHashApiKey é determinístico e coerente com gerarApiKey", () => {
    const chave = "jia_live_abc123";
    expect(calcularHashApiKey(chave)).toBe(calcularHashApiKey(chave));
    expect(calcularHashApiKey(chave)).toBe(createHash("sha256").update(chave, "utf8").digest("hex"));
  });
});
