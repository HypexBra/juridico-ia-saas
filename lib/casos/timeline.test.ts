import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/app/current-user", () => ({
  getUsuarioAtual: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { registrarEventoCaso, listarEventosCasoAction } from "./timeline";

const getUsuarioAtualMock = getUsuarioAtual as unknown as ReturnType<typeof vi.fn>;
const createClientMock = createClient as unknown as ReturnType<typeof vi.fn>;

/**
 * Fake mínimo do query builder do Supabase — mesmo padrão de
 * `lib/whatsapp/lembretes.test.ts`: encadeia os métodos usados por
 * `registrarEventoCaso`/`listarEventosCasoAction` (insert/select/eq/order)
 * e resolve como Promise/thenable, igual ao client real.
 */
type RespostaTabela = { data?: unknown; error?: unknown };

class FakeQueryBuilder implements PromiseLike<RespostaTabela> {
  constructor(
    private readonly resposta: RespostaTabela,
    public readonly chamadas: { insert: unknown[] } = { insert: [] },
  ) {}
  insert(payload: unknown) {
    this.chamadas.insert.push(payload);
    return this;
  }
  select() {
    return this;
  }
  eq() {
    return this;
  }
  order() {
    return this;
  }
  single<T>() {
    return this as unknown as PromiseLike<{ data: T | null; error: unknown }>;
  }
  returns<T>() {
    return this as unknown as PromiseLike<{ data: T | null; error: unknown }>;
  }
  then<TResult1 = RespostaTabela, TResult2 = never>(
    onfulfilled?: ((value: RespostaTabela) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({ data: this.resposta.data ?? null, error: this.resposta.error ?? null }).then(
      onfulfilled,
      onrejected,
    );
  }
}

function criarSupabaseFake(resposta: RespostaTabela): { supabase: SupabaseClient; builder: FakeQueryBuilder } {
  const builder = new FakeQueryBuilder(resposta);
  const from = vi.fn(() => builder);
  return { supabase: { from } as unknown as SupabaseClient, builder };
}

beforeEach(() => {
  getUsuarioAtualMock.mockReset();
  createClientMock.mockReset();
});

describe("registrarEventoCaso", () => {
  it("insere o evento com os campos mapeados para snake_case e retorna ok", async () => {
    const eventoInserido = {
      id: "evt-1",
      escritorio_id: "esc-1",
      ficha_caso_id: "ficha-1",
      tipo_evento: "prazo_concluido",
      descricao: 'Prazo "Recurso" marcado como concluído.',
      data_evento: "2026-08-20T12:00:00.000Z",
      origem: "manual",
      referencia_id: "prazo-1",
      criado_por: "perfil-1",
      criado_em: "2026-08-20T12:00:00.000Z",
    };
    const { supabase, builder } = criarSupabaseFake({ data: eventoInserido, error: null });

    const resultado = await registrarEventoCaso(supabase, {
      escritorioId: "esc-1",
      fichaCasoId: "ficha-1",
      tipoEvento: "prazo_concluido",
      descricao: 'Prazo "Recurso" marcado como concluído.',
      origem: "manual",
      referenciaId: "prazo-1",
      criadoPor: "perfil-1",
    });

    expect(resultado).toEqual({ ok: true, evento: eventoInserido });
    expect(builder.chamadas.insert[0]).toMatchObject({
      escritorio_id: "esc-1",
      ficha_caso_id: "ficha-1",
      tipo_evento: "prazo_concluido",
      origem: "manual",
      referencia_id: "prazo-1",
      criado_por: "perfil-1",
    });
  });

  it("usa a data atual como data_evento quando não informada", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-20T10:00:00.000Z"));

    const { supabase, builder } = criarSupabaseFake({
      data: { id: "evt-2" },
      error: null,
    });

    await registrarEventoCaso(supabase, {
      escritorioId: "esc-1",
      fichaCasoId: "ficha-1",
      tipoEvento: "documento_gerado",
      descricao: "Documento gerado.",
      origem: "documento",
    });

    expect(builder.chamadas.insert[0]).toMatchObject({ data_evento: "2026-08-20T10:00:00.000Z" });
    vi.useRealTimers();
  });

  it("rejeita sem consultar o banco quando ficha_caso_id está ausente", async () => {
    const { supabase } = criarSupabaseFake({ data: null, error: null });
    const fromSpy = supabase.from as unknown as ReturnType<typeof vi.fn>;

    const resultado = await registrarEventoCaso(supabase, {
      escritorioId: "esc-1",
      fichaCasoId: "",
      tipoEvento: "prazo_concluido",
      descricao: "Algo aconteceu.",
      origem: "manual",
    });

    expect(resultado.ok).toBe(false);
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("rejeita quando tipo_evento ou descricao estão vazios", async () => {
    const { supabase } = criarSupabaseFake({ data: null, error: null });

    const resultado = await registrarEventoCaso(supabase, {
      escritorioId: "esc-1",
      fichaCasoId: "ficha-1",
      tipoEvento: "  ",
      descricao: "Algo aconteceu.",
      origem: "ia",
    });

    expect(resultado.ok).toBe(false);
  });

  it("devolve { ok: false } sem lançar quando o insert falha", async () => {
    const { supabase } = criarSupabaseFake({ data: null, error: { message: "falha de rede" } });

    const resultado = await registrarEventoCaso(supabase, {
      escritorioId: "esc-1",
      fichaCasoId: "ficha-1",
      tipoEvento: "prazo_concluido",
      descricao: "Algo aconteceu.",
      origem: "manual",
    });

    expect(resultado).toEqual({ ok: false, error: expect.any(String) });
  });
});

describe("listarEventosCasoAction", () => {
  it("retorna erro sem consultar o banco quando não há sessão", async () => {
    getUsuarioAtualMock.mockResolvedValue(null);

    const resultado = await listarEventosCasoAction("ficha-1");

    expect(resultado).toEqual({ ok: false, error: expect.any(String) });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("lista os eventos da ficha ordenados por data_evento desc", async () => {
    getUsuarioAtualMock.mockResolvedValue({
      userId: "user-1",
      email: "a@a.com",
      perfil: { id: "perfil-1", escritorio_id: "esc-1" },
    });

    const eventos = [
      { id: "evt-2", ficha_caso_id: "ficha-1", data_evento: "2026-08-20T10:00:00.000Z" },
      { id: "evt-1", ficha_caso_id: "ficha-1", data_evento: "2026-08-19T10:00:00.000Z" },
    ];
    const { supabase } = criarSupabaseFake({ data: eventos, error: null });
    createClientMock.mockResolvedValue(supabase);

    const resultado = await listarEventosCasoAction("ficha-1");

    expect(resultado).toEqual({ ok: true, eventos });
  });
});
