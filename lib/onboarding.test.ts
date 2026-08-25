import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { aceitarConviteEquipeSePendente } from "./onboarding";

type RespostaTabela = { data?: unknown; error?: unknown };

/**
 * Fake mínimo do query builder do Supabase, mesmo padrão de
 * lib/casos/timeline.test.ts — aqui estendido para despachar uma resposta
 * DIFERENTE por chamada de `.from(tabela)` (na ordem em que ocorrem), já que
 * `aceitarConviteEquipeSePendente` encadeia 4 chamadas a tabelas distintas
 * (select convite → insert perfil → update convite → select escritório).
 */
class FakeQueryBuilder implements PromiseLike<RespostaTabela> {
  constructor(private readonly resposta: RespostaTabela) {}
  select() {
    return this;
  }
  insert(payload: unknown) {
    chamadasRegistradas.push({ metodo: "insert", payload });
    return this;
  }
  update(payload: unknown) {
    chamadasRegistradas.push({ metodo: "update", payload });
    return this;
  }
  eq() {
    return this;
  }
  order() {
    return this;
  }
  limit() {
    return this;
  }
  maybeSingle<T>() {
    return Promise.resolve({ data: (this.resposta.data ?? null) as T | null, error: this.resposta.error ?? null });
  }
  single<T>() {
    return Promise.resolve({ data: (this.resposta.data ?? null) as T | null, error: this.resposta.error ?? null });
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

let chamadasRegistradas: Array<{ metodo: string; payload: unknown }>;

function criarSupabaseFakeSequencial(respostasPorTabela: Record<string, RespostaTabela>): SupabaseClient {
  chamadasRegistradas = [];
  const from = vi.fn((tabela: string) => new FakeQueryBuilder(respostasPorTabela[tabela] ?? { data: null, error: null }));
  return { from } as unknown as SupabaseClient;
}

const CONVITE = {
  id: "convite-1",
  escritorio_id: "esc-existente",
  email: "novo@escritorio.com.br",
  nome: "Fulano de Tal",
  role: "advogado",
  status: "pendente",
  criado_por: "perfil-owner",
  criado_em: "2026-08-20T12:00:00.000Z",
  expira_em: "2026-08-27T12:00:00.000Z",
  aceito_em: null,
};

const ESCRITORIO = { id: "esc-existente", nome: "Escritório Existente", slug: "escritorio-existente", plano: "pro" };

describe("aceitarConviteEquipeSePendente", () => {
  it("sem convite pendente para o e-mail da sessão, retorna null sem tocar em perfis/escritorios", async () => {
    const supabase = criarSupabaseFakeSequencial({
      convites_equipe: { data: null, error: null },
    });

    const resultado = await aceitarConviteEquipeSePendente(supabase, "auth-user-1");

    expect(resultado).toBeNull();
    expect(chamadasRegistradas).toEqual([]);
  });

  it("com convite pendente, cria o perfil DIRETO no escritório do convite (nunca cria escritório novo) e marca o convite como aceito", async () => {
    const supabase = criarSupabaseFakeSequencial({
      convites_equipe: { data: CONVITE, error: null },
      perfis: { data: null, error: null },
      escritorios: { data: ESCRITORIO, error: null },
    });

    const resultado = await aceitarConviteEquipeSePendente(supabase, "auth-user-1");

    expect(resultado).toEqual(ESCRITORIO);
    const insertPerfil = chamadasRegistradas.find((c) => c.metodo === "insert");
    expect(insertPerfil?.payload).toMatchObject({
      auth_user_id: "auth-user-1",
      escritorio_id: "esc-existente",
      nome: "Fulano de Tal",
      role: "advogado",
    });
    const updateConvite = chamadasRegistradas.find((c) => c.metodo === "update");
    expect(updateConvite?.payload).toMatchObject({ status: "aceito" });
  });

  it("retorna null (não lança) quando a busca do convite falha", async () => {
    const supabase = criarSupabaseFakeSequencial({
      convites_equipe: { data: null, error: new Error("timeout") },
    });

    const resultado = await aceitarConviteEquipeSePendente(supabase, "auth-user-1");

    expect(resultado).toBeNull();
  });
});
