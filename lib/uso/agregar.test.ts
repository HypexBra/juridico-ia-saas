import { describe, expect, it } from "vitest";
import {
  PRECOS_POR_MILHAO,
  agregarPorDia,
  agregarPorOrigem,
  agregarTotais,
  agruparCustoPorEscritorio,
  calcularCustoEstimado,
  type RegistroUsoIa,
  type RegistroUsoIaComEscritorio,
} from "./agregar";

const BASE_REGISTRO: RegistroUsoIa = {
  criado_em: "2026-08-10T12:00:00.000Z",
  mes_ref: "2026-08",
  tokens_in: 1000,
  tokens_out: 500,
  duracao_ms: 800,
  modelo: "gemini-flash-latest",
  origem: "chat",
};

// Spread direto (não `??` campo a campo): override explícito `null` precisa
// vencer o default — é exatamente o caso dos campos opcionais do banco.
function registro(overrides: Partial<RegistroUsoIa> = {}): RegistroUsoIa {
  return { ...BASE_REGISTRO, ...overrides };
}

describe("PRECOS_POR_MILHAO", () => {
  it("cobre os modelos realmente usados pelas chamadas de IA do projeto", () => {
    // Nomes exatos declarados nas constantes dos providers:
    // gemini.ts (MODELO_FLASH/MODELO_PRO/MODELO_FALLBACK_QUOTA),
    // groq.ts (MODELO_GROQ) e lib/rag/embeddings.ts (MODELO_EMBEDDING).
    expect(Object.keys(PRECOS_POR_MILHAO)).toEqual(
      expect.arrayContaining([
        "gemini-flash-latest",
        "gemini-flash-lite-latest",
        "openai/gpt-oss-120b",
        "gemini-embedding-001",
      ]),
    );
  });

  it("tem preço de entrada e saída positivos para todo modelo listado", () => {
    for (const preco of Object.values(PRECOS_POR_MILHAO)) {
      expect(preco.entrada).toBeGreaterThanOrEqual(0);
      expect(preco.saida).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("calcularCustoEstimado", () => {
  it("retorna null com zero registros (nunca inventa custo)", () => {
    const resultado = calcularCustoEstimado([], PRECOS_POR_MILHAO);
    expect(resultado.totalUsd).toBeNull();
    expect(resultado.registrosPrecificados).toBe(0);
    expect(resultado.registrosTotal).toBe(0);
  });

  it("soma entrada e saída dos registros com modelo conhecido", () => {
    const preco = PRECOS_POR_MILHAO["gemini-flash-latest"];
    if (!preco) throw new Error("modelo de teste ausente na tabela de preços");

    const resultado = calcularCustoEstimado(
      [registro({ tokens_in: 1_000_000, tokens_out: 1_000_000 })],
      PRECOS_POR_MILHAO,
    );
    expect(resultado.totalUsd).toBeCloseTo(preco.entrada + preco.saida, 10);
    expect(resultado.registrosPrecificados).toBe(1);
    expect(resultado.registrosTotal).toBe(1);
  });

  it("deixa FORA do cálculo o registro com modelo desconhecido (ou null)", () => {
    const resultado = calcularCustoEstimado(
      [
        registro({ modelo: "modelo-secreto-futuro" }),
        registro({ modelo: null }),
        registro(),
      ],
      PRECOS_POR_MILHAO,
    );
    expect(resultado.registrosTotal).toBe(3);
    expect(resultado.registrosPrecificados).toBe(1);
    expect(resultado.totalUsd).not.toBeNull();
    expect(resultado.totalUsd).toBeGreaterThan(0);
  });

  it("retorna null quando TODOS os registros têm modelo desconhecido", () => {
    const resultado = calcularCustoEstimado([registro({ modelo: "desconhecido-x" })], PRECOS_POR_MILHAO);
    expect(resultado.totalUsd).toBeNull();
    expect(resultado.registrosPrecificados).toBe(0);
  });

  it("respeita a tabela passada como parâmetro (não a global)", () => {
    const resultado = calcularCustoEstimado(
      [registro({ tokens_in: 1_000_000, tokens_out: 1_000_000 })],
      { "gemini-flash-latest": { entrada: 1, saida: 2 } },
    );
    expect(resultado.totalUsd).toBeCloseTo(3, 10);
  });
});

describe("agregarTotais", () => {
  it("retorna totais zerados e duração média null com zero registros", () => {
    expect(agregarTotais([])).toEqual({ chamadas: 0, tokensIn: 0, tokensOut: 0, duracaoMediaMs: null });
  });

  it("soma tokens e calcula a duração média ignorando durações ausentes", () => {
    const totais = agregarTotais([
      registro({ tokens_in: 100, tokens_out: 50, duracao_ms: 1000 }),
      registro({ tokens_in: 300, tokens_out: 150, duracao_ms: null }),
      registro({ tokens_in: 100, tokens_out: 0, duracao_ms: 3000 }),
    ]);
    expect(totais.chamadas).toBe(3);
    expect(totais.tokensIn).toBe(500);
    expect(totais.tokensOut).toBe(200);
    expect(totais.duracaoMediaMs).toBe(2000);
  });
});

describe("agregarPorDia", () => {
  const hoje = new Date("2026-08-20T18:00:00.000Z");

  it("produz janela fixa dos últimos N dias, inclusive dias sem uso (zero)", () => {
    const dias = agregarPorDia([], hoje, 7);
    expect(dias).toHaveLength(7);
    expect(dias[0]?.dia).toBe("2026-08-14");
    expect(dias[dias.length - 1]?.dia).toBe("2026-08-20");
    expect(dias.every((d) => d.chamadas === 0 && d.tokens === 0)).toBe(true);
  });

  it("agrega chamadas/tokens no dia certo e rotula DD/MM", () => {
    const dias = agregarPorDia(
      [
        registro({ criado_em: "2026-08-19T10:00:00.000Z", tokens_in: 100, tokens_out: 40 }),
        registro({ criado_em: "2026-08-19T22:30:00.000Z", tokens_in: 60, tokens_out: 20 }),
        registro({ criado_em: "2026-08-20T01:00:00.000Z", tokens_in: 10, tokens_out: 5 }),
      ],
      hoje,
      7,
    );

    const dia19 = dias.find((d) => d.dia === "2026-08-19");
    expect(dia19).toBeDefined();
    expect(dia19?.chamadas).toBe(2);
    expect(dia19?.tokens).toBe(220); // 140 + 80
    expect(dia19?.rotulo).toBe("19/08");

    const dia20 = dias.find((d) => d.dia === "2026-08-20");
    expect(dia20?.chamadas).toBe(1);
    expect(dia20?.tokens).toBe(15);
  });

  it("ignora registros fora da janela (mais antigos que o início)", () => {
    const dias = agregarPorDia([registro({ criado_em: "2026-07-01T10:00:00.000Z" })], hoje, 7);
    expect(dias.every((d) => d.chamadas === 0)).toBe(true);
  });

  it("mantém ordem cronológica (mais antigo -> mais recente)", () => {
    const dias = agregarPorDia([], hoje, 5);
    for (let i = 1; i < dias.length; i++) {
      const anterior = dias[i - 1];
      const atual = dias[i];
      expect(anterior && atual ? anterior.dia < atual.dia : false).toBe(true);
    }
  });
});

describe("agruparCustoPorEscritorio", () => {
  function registroEscritorio(
    escritorioId: string,
    overrides: Partial<RegistroUsoIa> = {},
  ): RegistroUsoIaComEscritorio {
    return { ...registro(overrides), escritorio_id: escritorioId };
  }

  it("retorna lista vazia com zero registros", () => {
    expect(agruparCustoPorEscritorio([], PRECOS_POR_MILHAO)).toEqual([]);
  });

  it("agrupa custo por escritorio_id, um total por escritório", () => {
    const linhas = agruparCustoPorEscritorio(
      [
        registroEscritorio("escritorio-a", { tokens_in: 1_000_000, tokens_out: 0 }),
        registroEscritorio("escritorio-a", { tokens_in: 1_000_000, tokens_out: 0 }),
        registroEscritorio("escritorio-b", { tokens_in: 1_000_000, tokens_out: 0 }),
      ],
      PRECOS_POR_MILHAO,
    );

    const precoEntrada = PRECOS_POR_MILHAO["gemini-flash-latest"]?.entrada ?? 0;
    const linhaA = linhas.find((l) => l.escritorioId === "escritorio-a");
    const linhaB = linhas.find((l) => l.escritorioId === "escritorio-b");

    expect(linhaA?.totalUsd).toBeCloseTo(precoEntrada * 2, 10);
    expect(linhaA?.registrosPrecificados).toBe(2);
    expect(linhaB?.totalUsd).toBeCloseTo(precoEntrada, 10);
  });

  it("ordena por totalUsd decrescente, tratando null (sem registro precificável) como o menor", () => {
    const linhas = agruparCustoPorEscritorio(
      [
        registroEscritorio("barato", { tokens_in: 1000, tokens_out: 0 }),
        registroEscritorio("caro", { tokens_in: 10_000_000, tokens_out: 0 }),
        registroEscritorio("sem-preco", { modelo: "modelo-desconhecido" }),
      ],
      PRECOS_POR_MILHAO,
    );

    expect(linhas.map((l) => l.escritorioId)).toEqual(["caro", "barato", "sem-preco"]);
    expect(linhas.find((l) => l.escritorioId === "sem-preco")?.totalUsd).toBeNull();
  });

  it("nunca inventa custo pra modelo desconhecido, mesmo agrupado por escritório", () => {
    const linhas = agruparCustoPorEscritorio(
      [registroEscritorio("escritorio-x", { modelo: "modelo-secreto-futuro" })],
      PRECOS_POR_MILHAO,
    );
    expect(linhas).toHaveLength(1);
    expect(linhas[0]?.totalUsd).toBeNull();
    expect(linhas[0]?.registrosPrecificados).toBe(0);
    expect(linhas[0]?.registrosTotal).toBe(1);
  });
});

describe("agregarPorOrigem", () => {
  it("agrupa por origem ordenando por chamadas decrescente", () => {
    const linhas = agregarPorOrigem([
      registro({ origem: "chat" }),
      registro({ origem: "chat" }),
      registro({ origem: "analise_ficha" }),
    ]);
    expect(linhas[0]).toMatchObject({ origem: "chat", chamadas: 2, tokens: 3000 });
    expect(linhas[1]).toMatchObject({ origem: "analise_ficha", chamadas: 1, tokens: 1500 });
  });

  it('rotula registros sem origem como "—" e limita ao top N', () => {
    const registros = [
      registro({ origem: null }),
      ...Array.from({ length: 10 }, () => registro({ origem: `origem-${Math.random()}` })),
    ];
    const linhas = agregarPorOrigem(registros, 3);
    expect(linhas).toHaveLength(3);
  });

  it("retorna lista vazia com zero registros", () => {
    expect(agregarPorOrigem([])).toEqual([]);
  });
});
