import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MEMORIA_ESCRITORIO_DEFAULT,
  TOM_LABELS,
  blocoContextoEscritorio,
  carregarMemoriaEscritorio,
  normalizarTom,
  type MemoriaEscritorio,
} from "./contexto-escritorio";

/**
 * Fake mínimo do builder do supabase-js (from → select → eq → single) —
 * `carregarMemoriaEscritorio` só usa essa cadeia.
 */
function fakeSupabase(resposta: { data: unknown; error: unknown }): SupabaseClient {
  const builder = {
    select: () => builder,
    eq: () => builder,
    single: async () => resposta,
  };
  return { from: () => builder } as unknown as SupabaseClient;
}

describe("TOM_LABELS", () => {
  it("tem rótulo pt-BR para cada tom válido", () => {
    expect(TOM_LABELS).toEqual({
      formal: "Formal jurídico",
      objetivo: "Objetivo e direto",
      acessivel: "Acessível ao cliente",
    });
  });
});

describe("normalizarTom", () => {
  it("aceita os três valores canônicos", () => {
    expect(normalizarTom("formal")).toBe("formal");
    expect(normalizarTom("objetivo")).toBe("objetivo");
    expect(normalizarTom("acessivel")).toBe("acessivel");
  });

  it("é tolerante a caixa, espaços e acento", () => {
    expect(normalizarTom(" OBJETIVO ")).toBe("objetivo");
    expect(normalizarTom("Acessível")).toBe("acessivel");
    expect(normalizarTom("FORMAL")).toBe("formal");
  });

  it("cai no default 'formal' para valor desconhecido ou tipo errado", () => {
    expect(normalizarTom("irreverente")).toBe("formal");
    expect(normalizarTom("")).toBe("formal");
    expect(normalizarTom(null)).toBe("formal");
    expect(normalizarTom(undefined)).toBe("formal");
    expect(normalizarTom(42)).toBe("formal");
    expect(normalizarTom({})).toBe("formal");
  });
});

describe("carregarMemoriaEscritorio", () => {
  it("mapeia as colunas do banco para a memória tipada", async () => {
    const memoria = await carregarMemoriaEscritorio(
      fakeSupabase({
        data: { diretrizes_ia: "Sempre citar base legal.", tom_escrita: "objetivo", clausulas_padrao: "CLÁUSULA DE…" },
        error: null,
      }),
      "escritorio-1",
    );
    expect(memoria).toEqual({
      tomEscrita: "objetivo",
      diretrizes: "Sempre citar base legal.",
      clausulasPadrao: "CLÁUSULA DE…",
    });
  });

  it("retorna os defaults quando a consulta falha (nunca quebra o fluxo)", async () => {
    const memoria = await carregarMemoriaEscritorio(
      fakeSupabase({ data: null, error: { message: "RLS/erro qualquer" } }),
      "escritorio-1",
    );
    expect(memoria).toEqual(MEMORIA_ESCRITORIO_DEFAULT);
  });

  it("retorna os defaults quando não há linha (data null)", async () => {
    const memoria = await carregarMemoriaEscritorio(
      fakeSupabase({ data: null, error: null }),
      "escritorio-inexistente",
    );
    expect(memoria).toEqual(MEMORIA_ESCRITORIO_DEFAULT);
  });

  it("normaliza tom inválido vindo do banco em vez de propagar", async () => {
    const memoria = await carregarMemoriaEscritorio(
      fakeSupabase({ data: { diretrizes_ia: "", tom_escrita: "gritante", clausulas_padrao: "" }, error: null }),
      "escritorio-1",
    );
    expect(memoria.tomEscrita).toBe("formal");
  });
});

describe("blocoContextoEscritorio", () => {
  it('retorna "" quando a memória está vazia/padrão', () => {
    expect(blocoContextoEscritorio(MEMORIA_ESCRITORIO_DEFAULT)).toBe("");
    expect(
      blocoContextoEscritorio({ tomEscrita: "formal", diretrizes: "   ", clausulasPadrao: "" }),
    ).toBe("");
  });

  it("monta bloco delimitado com rótulo do tom e seções presentes", () => {
    const memoria: MemoriaEscritorio = {
      tomEscrita: "objetivo",
      diretrizes: "Nunca inventar jurisprudência.",
      clausulasPadrao: "",
    };
    const bloco = blocoContextoEscritorio(memoria);
    expect(bloco).toContain("DIRETRIZES DO ESCRITÓRIO");
    expect(bloco).toContain(TOM_LABELS.objetivo);
    expect(bloco).toContain("Nunca inventar jurisprudência.");
    // Seção sem conteúdo não entra no bloco.
    expect(bloco).not.toContain("Cláusulas padrão");
  });

  it("bloco só de tom (sem textos) ainda é útil e delimitado", () => {
    const bloco = blocoContextoEscritorio({ ...MEMORIA_ESCRITORIO_DEFAULT, tomEscrita: "acessivel" });
    expect(bloco).toContain(TOM_LABELS.acessivel);
    expect(bloco.startsWith("===")).toBe(true);
    expect(bloco.endsWith("===")).toBe(true);
  });

  it("trunca texto longo preservando palavra inteira antes da reticência", () => {
    const diretrizes = Array.from({ length: 200 }, (_, i) => `palavra${i}`).join(" ");
    const bloco = blocoContextoEscritorio(
      { tomEscrita: "formal", diretrizes, clausulasPadrao: "" },
      600,
    );

    expect(bloco.length).toBeLessThanOrEqual(600);
    expect(bloco).toContain("…");

    // Nenhuma palavra cortada no meio: todo token entre espaços é uma palavra completa.
    const trechoTruncado = bloco.split("\n").find((linha) => linha.includes("palavra"));
    if (!trechoTruncado) throw new Error("trecho truncado não encontrado");
    const ultimaPalavra = trechoTruncado.replace(/…$/, "").trim().split(" ").pop() ?? "";
    expect(diretrizes).toContain(ultimaPalavra);
    expect(trechoTruncado.trim().endsWith(` ${ultimaPalavra}`.trim())).toBe(false);
    expect(trechoTruncado.trim().endsWith(`${ultimaPalavra} …`) || trechoTruncado.includes(`${ultimaPalavra}…`)).toBe(true);
  });

  it("respeita maxChars customizado pequeno sem estourar", () => {
    const bloco = blocoContextoEscritorio(
      {
        tomEscrita: "objetivo",
        diretrizes: "Diretriz longa demais para caber. ".repeat(50),
        clausulasPadrao: "Cláusula longa demais para caber. ".repeat(50),
      },
      300,
    );
    expect(bloco.length).toBeLessThanOrEqual(300);
    expect(bloco).toContain(TOM_LABELS.objetivo);
  });

  it("é determinístico (mesma entrada -> mesma saída)", () => {
    const memoria: MemoriaEscritorio = {
      tomEscrita: "formal",
      diretrizes: "Revisar sempre.",
      clausulasPadrao: "Cláusula de confidencialidade.",
    };
    expect(blocoContextoEscritorio(memoria)).toBe(blocoContextoEscritorio(memoria));
  });
});
