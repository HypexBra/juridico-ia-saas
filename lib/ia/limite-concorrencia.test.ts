import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { existeProcessamentoIaEmAndamento } from "./limite-concorrencia";

const createClientMock = createClient as unknown as ReturnType<typeof vi.fn>;

/**
 * Fake mínimo do query builder do Supabase — mesmo padrão de
 * `lib/casos/timeline.test.ts`: encadeia os métodos usados por
 * `existeProcessamentoIaEmAndamento` (select/eq/gt, com `count`/`error`
 * resolvidos no `then`) por tabela.
 */
type RespostaCount = { count?: number | null; error?: unknown };

class FakeQueryBuilder implements PromiseLike<RespostaCount> {
  constructor(private readonly resposta: RespostaCount) {}
  select() {
    return this;
  }
  eq() {
    return this;
  }
  gt() {
    return this;
  }
  then<TResult1 = RespostaCount, TResult2 = never>(
    onfulfilled?: ((value: RespostaCount) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({ count: this.resposta.count ?? 0, error: this.resposta.error ?? null }).then(
      onfulfilled,
      onrejected,
    );
  }
}

/** Cria um supabase fake cuja resposta de `count`/`error` por tabela é decidida por `respostaPorTabela`. */
function criarSupabaseFake(respostaPorTabela: (tabela: string) => RespostaCount): SupabaseClient {
  const from = vi.fn((tabela: string) => new FakeQueryBuilder(respostaPorTabela(tabela)));
  return { from } as unknown as SupabaseClient;
}

beforeEach(() => {
  createClientMock.mockReset();
});

describe("existeProcessamentoIaEmAndamento", () => {
  it("retorna false quando nenhuma das 4 tabelas tem processamento em andamento", async () => {
    const supabase = criarSupabaseFake(() => ({ count: 0, error: null }));
    createClientMock.mockResolvedValue(supabase);

    const resultado = await existeProcessamentoIaEmAndamento("esc-1");

    expect(resultado).toBe(false);
    expect(supabase.from).toHaveBeenCalledWith("analises_processo");
    expect(supabase.from).toHaveBeenCalledWith("analises_documento");
    expect(supabase.from).toHaveBeenCalledWith("comparacoes_documento");
    expect(supabase.from).toHaveBeenCalledWith("auditorias_peca");
  });

  it("retorna true quando apenas 1 das 4 tabelas tem processamento dentro da janela", async () => {
    const supabase = criarSupabaseFake((tabela) => ({
      count: tabela === "auditorias_peca" ? 1 : 0,
      error: null,
    }));
    createClientMock.mockResolvedValue(supabase);

    const resultado = await existeProcessamentoIaEmAndamento("esc-1");

    expect(resultado).toBe(true);
  });

  it("retorna false quando o único processamento encontrado está fora da janela (query já filtra por criado_em)", async () => {
    // A filtragem por janela acontece na própria query (`.gt("criado_em", limite)`),
    // então um registro "fora da janela" nunca é contado pelo banco: o fake
    // simula esse comportamento devolvendo count 0 para todas as tabelas,
    // como o Postgres faria ao aplicar o filtro `criado_em > limite`.
    const supabase = criarSupabaseFake(() => ({ count: 0, error: null }));
    createClientMock.mockResolvedValue(supabase);

    const resultado = await existeProcessamentoIaEmAndamento("esc-1", 10);

    expect(resultado).toBe(false);
  });

  it("faz fail-open (retorna false, não lança) quando uma das tabelas devolve erro de leitura", async () => {
    const supabase = criarSupabaseFake((tabela) => ({
      count: null,
      error: tabela === "analises_processo" ? { message: "falha de rede" } : null,
    }));
    createClientMock.mockResolvedValue(supabase);

    await expect(existeProcessamentoIaEmAndamento("esc-1")).resolves.toBe(false);
  });

  it("faz fail-open mesmo quando TODAS as tabelas falham", async () => {
    const supabase = criarSupabaseFake(() => ({ count: null, error: { message: "timeout" } }));
    createClientMock.mockResolvedValue(supabase);

    await expect(existeProcessamentoIaEmAndamento("esc-1")).resolves.toBe(false);
  });
});
