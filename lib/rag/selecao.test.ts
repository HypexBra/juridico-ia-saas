import { describe, expect, it } from "vitest";
import { selecionarChunks, sobreposicaoTextual, SELECAO_PADRAO, type ChunkSelecionavel } from "./selecao";

function chunk(over: Partial<ChunkSelecionavel> & { distancia: number }): ChunkSelecionavel {
  return {
    fonteTipo: "documento_upload",
    fonteId: "f1",
    conteudo: "conteudo padrao de teste com algumas palavras suficientes",
    ...over,
  };
}

/** Texto único de N palavras, para não disparar o filtro de redundância sem querer. */
function texto(semente: string, palavras = 40): string {
  return Array.from({ length: palavras }, (_, i) => `${semente}${i}`).join(" ");
}

describe("sobreposicaoTextual", () => {
  it("é 1.0 para textos idênticos", () => {
    const t = texto("a");
    expect(sobreposicaoTextual(t, t)).toBe(1);
  });

  it("é 0 para textos sem 5-grams em comum", () => {
    expect(sobreposicaoTextual(texto("a"), texto("b"))).toBe(0);
  });

  it("é assimétrica: trecho contido no maior tem sobreposição alta", () => {
    const grande = texto("x", 60);
    const contido = grande.split(" ").slice(10, 30).join(" ");
    // O que importa é "quanto do candidato é novidade" — quase nada aqui.
    expect(sobreposicaoTextual(contido, grande)).toBeGreaterThan(0.9);
    expect(sobreposicaoTextual(grande, contido)).toBeLessThan(0.5);
  });

  it("é 0 quando algum lado é curto demais para formar 5-grams", () => {
    expect(sobreposicaoTextual("dois termos", texto("a"))).toBe(0);
  });
});

describe("selecionarChunks", () => {
  it("descarta o que passa do corte absoluto de distância", () => {
    const r = selecionarChunks([
      chunk({ distancia: 0.2, conteudo: texto("a") }),
      chunk({ distancia: 0.95, conteudo: texto("b") }),
    ]);
    expect(r.selecionados).toHaveLength(1);
    expect(r.descartes.porDistanciaAbsoluta).toBe(1);
  });

  it("descarta o que está muito atrás do primeiro colocado (corte relativo)", () => {
    // 0.68 passa no corte absoluto de 0.7, mas está 0.46 atrás do melhor —
    // é "assunto vizinho", não resposta. Antes ele entrava e custava tokens.
    const r = selecionarChunks([
      chunk({ distancia: 0.22, conteudo: texto("a") }),
      chunk({ distancia: 0.68, conteudo: texto("b") }),
    ]);
    expect(r.selecionados).toHaveLength(1);
    expect(r.descartes.porMargemRelativa).toBe(1);
  });

  it("mantém o segundo colocado quando ele está perto do primeiro", () => {
    const r = selecionarChunks([
      chunk({ distancia: 0.22, conteudo: texto("a") }),
      chunk({ distancia: 0.3, conteudo: texto("b") }),
    ]);
    expect(r.selecionados).toHaveLength(2);
    expect(r.descartes.porMargemRelativa).toBe(0);
  });

  it("nunca descarta o primeiro colocado, mesmo sozinho e enorme", () => {
    const gigante = texto("z", 5000);
    const r = selecionarChunks([chunk({ distancia: 0.5, conteudo: gigante })]);
    expect(r.selecionados).toHaveLength(1);
    expect(r.charsUsados).toBeGreaterThan(SELECAO_PADRAO.orcamentoChars);
  });

  it("deduplica chunks vizinhos sobrepostos da mesma fonte", () => {
    // Reproduz o overlap real que lib/rag/chunking.ts gera de propósito:
    // dois chunks consecutivos compartilham a cauda do anterior.
    const base = texto("p", 60);
    const vizinho = base.split(" ").slice(5).join(" ");
    const r = selecionarChunks([
      chunk({ distancia: 0.2, conteudo: base }),
      chunk({ distancia: 0.22, conteudo: vizinho }),
    ]);
    expect(r.selecionados).toHaveLength(1);
    expect(r.descartes.porRedundancia).toBe(1);
  });

  it("respeita o orçamento de caracteres", () => {
    const candidatos = Array.from({ length: 6 }, (_, i) =>
      chunk({ distancia: 0.2 + i * 0.01, conteudo: texto(`s${i}_`, 400) }),
    );
    const r = selecionarChunks(candidatos);
    expect(r.charsUsados).toBeLessThanOrEqual(SELECAO_PADRAO.orcamentoChars);
    expect(r.descartes.porOrcamento).toBeGreaterThan(0);
  });

  it("respeita o teto por fonte_tipo (diversidade)", () => {
    const candidatos = [
      ...Array.from({ length: 5 }, (_, i) =>
        chunk({ distancia: 0.2 + i * 0.005, fonteTipo: "jurisprudencia", conteudo: texto(`j${i}_`) }),
      ),
      chunk({ distancia: 0.24, fonteTipo: "ficha_caso", conteudo: texto("fc") }),
    ];
    const r = selecionarChunks(candidatos);
    const porTipo = r.selecionados.filter((c) => c.fonteTipo === "jurisprudencia");
    expect(porTipo.length).toBeLessThanOrEqual(SELECAO_PADRAO.maxPorFonte);
    expect(r.selecionados.some((c) => c.fonteTipo === "ficha_caso")).toBe(true);
    expect(r.descartes.porTetoDeFonte).toBe(1);
  });

  it("respeita o topK", () => {
    const candidatos = Array.from({ length: 20 }, (_, i) =>
      chunk({ distancia: 0.2 + i * 0.001, fonteTipo: `tipo${i % 6}`, conteudo: texto(`t${i}_`, 20) }),
    );
    expect(selecionarChunks(candidatos).selecionados.length).toBeLessThanOrEqual(SELECAO_PADRAO.topK);
  });

  it("devolve vazio quando nada passa do corte absoluto", () => {
    const r = selecionarChunks([chunk({ distancia: 1.4 }), chunk({ distancia: 0.9 })]);
    expect(r.selecionados).toEqual([]);
    expect(r.charsUsados).toBe(0);
  });

  it("lista vazia não quebra", () => {
    expect(selecionarChunks([]).selecionados).toEqual([]);
  });

  it("ordena por relevância mesmo recebendo fora de ordem", () => {
    const r = selecionarChunks([
      chunk({ distancia: 0.3, conteudo: texto("b") }),
      chunk({ distancia: 0.15, conteudo: texto("a") }),
    ]);
    expect(r.selecionados[0].distancia).toBe(0.15);
  });
});
