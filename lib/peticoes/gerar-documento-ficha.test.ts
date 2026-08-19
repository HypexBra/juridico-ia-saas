import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { gerarDocumentoDaFicha } from "./gerar-documento-ficha";

type RespostaTabela = { data: unknown; error: unknown };

/**
 * Fake mínimo do query builder do supabase-js: encadeia `select/eq/not/order/
 * limit` (todos retornam o próprio builder) e resolve em `maybeSingle`/
 * `single`, igual ao usado pela orquestração real. `insert` é capturado
 * separadamente para inspecionar o payload de auditoria em
 * `peticoes_geradas` sem precisar de um Postgres real.
 */
function criarSupabaseFake(
  respostasPorTabela: Record<string, RespostaTabela>,
  opts: { erroInsertPeticoesGeradas?: unknown } = {},
) {
  const inserts: { tabela: string; valores: unknown }[] = [];

  function criarBuilder(resposta: RespostaTabela) {
    const builder = {
      select: () => builder,
      eq: () => builder,
      not: () => builder,
      order: () => builder,
      limit: () => builder,
      maybeSingle: async () => resposta,
      single: async () => resposta,
    };
    return builder;
  }

  const supabaseFake = {
    from(tabela: string) {
      const resposta = respostasPorTabela[tabela] ?? { data: null, error: null };
      return {
        ...criarBuilder(resposta),
        insert: async (valores: unknown) => {
          inserts.push({ tabela, valores });
          if (tabela === "peticoes_geradas" && opts.erroInsertPeticoesGeradas) {
            return { error: opts.erroInsertPeticoesGeradas };
          }
          return { error: null };
        },
      };
    },
  };

  return { supabase: supabaseFake as unknown as SupabaseClient, inserts };
}

const PARAMS_BASE = { fichaId: "ficha-1", modeloId: "modelo-1", escritorioId: "escritorio-1", perfilId: "perfil-1" };

describe("gerarDocumentoDaFicha", () => {
  it("retorna erro quando modeloId não é informado", async () => {
    const { supabase } = criarSupabaseFake({});
    const resultado = await gerarDocumentoDaFicha(supabase, { ...PARAMS_BASE, modeloId: "" });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toMatch(/selecione um modelo/i);
  });

  it("retorna erro quando o modelo não é encontrado", async () => {
    const { supabase } = criarSupabaseFake({
      modelos: { data: null, error: null },
    });

    const resultado = await gerarDocumentoDaFicha(supabase, PARAMS_BASE);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toMatch(/modelo não encontrado/i);
  });

  it("retorna erro quando a ficha não é encontrada", async () => {
    const { supabase } = criarSupabaseFake({
      modelos: { data: { id: "modelo-1", nome: "Petição inicial", conteudo: "Olá {{nome_cliente}}" }, error: null },
      fichas_caso: { data: null, error: null },
    });

    const resultado = await gerarDocumentoDaFicha(supabase, PARAMS_BASE);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toMatch(/ficha não encontrada/i);
  });

  it("resolve as variáveis a partir da ficha, do prazo mais recente e do contrato mais recente, e audita em peticoes_geradas", async () => {
    const { supabase, inserts } = criarSupabaseFake({
      modelos: {
        data: {
          id: "modelo-1",
          nome: "Petição inicial",
          conteudo: "Cliente: {{nome_cliente}}, processo {{numero_processo}}, valor {{valor_causa}}, área {{area_direito}}, hoje {{data_hoje}}.",
        },
        error: null,
      },
      fichas_caso: {
        data: { id: "ficha-1", nome_cliente: "Maria Souza", area_direito: "Trabalhista", cliente_id: null },
        error: null,
      },
      prazos: { data: { numero_processo_cnj: "0001234-56.2026.8.26.0100" }, error: null },
      contratos_honorario: { data: { valor_total: 15000 }, error: null },
    });

    const resultado = await gerarDocumentoDaFicha(supabase, PARAMS_BASE);

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.modelo).toEqual({
      id: "modelo-1",
      nome: "Petição inicial",
      conteudo: expect.stringContaining("Cliente:"),
    });
    expect(resultado.resultado.textoFinal).toContain("Cliente: Maria Souza");
    expect(resultado.resultado.textoFinal).toContain("processo 0001234-56.2026.8.26.0100");
    expect(resultado.resultado.textoFinal).toContain("área Trabalhista");
    expect(resultado.resultado.variaveisNaoResolvidas).toEqual([]);

    const insertAuditoria = inserts.find((i) => i.tabela === "peticoes_geradas");
    expect(insertAuditoria?.valores).toMatchObject({
      escritorio_id: "escritorio-1",
      modelo_id: "modelo-1",
      ficha_caso_id: "ficha-1",
      gerado_por: "perfil-1",
      variaveis_usadas: expect.objectContaining({ nome_cliente: "Maria Souza" }),
    });
  });

  it("busca o nome do cliente pela relação clientes.nome quando a ficha não tem nome_cliente direto", async () => {
    const { supabase } = criarSupabaseFake({
      modelos: { data: { id: "modelo-1", nome: "M", conteudo: "{{nome_cliente}}" }, error: null },
      fichas_caso: { data: { id: "ficha-1", nome_cliente: null, area_direito: null, cliente_id: "cliente-1" }, error: null },
      clientes: { data: { nome: "João Pereira" }, error: null },
      prazos: { data: null, error: null },
      contratos_honorario: { data: null, error: null },
    });

    const resultado = await gerarDocumentoDaFicha(supabase, PARAMS_BASE);

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.resultado.textoFinal).toBe("João Pereira");
  });

  it("lista variáveis não resolvidas quando não há prazo/contrato vinculado, sem bloquear a geração", async () => {
    const { supabase } = criarSupabaseFake({
      modelos: { data: { id: "modelo-1", nome: "M", conteudo: "{{numero_processo}} {{valor_causa}}", }, error: null },
      fichas_caso: { data: { id: "ficha-1", nome_cliente: "Cliente X", area_direito: null, cliente_id: null }, error: null },
      prazos: { data: null, error: null },
      contratos_honorario: { data: null, error: null },
    });

    const resultado = await gerarDocumentoDaFicha(supabase, PARAMS_BASE);

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.resultado.variaveisNaoResolvidas.sort()).toEqual(["numero_processo", "valor_causa"]);
    }
  });

  it("retorna erro (sem devolver o texto gerado) quando o insert de auditoria falha", async () => {
    const erroFake = { message: "insert falhou" };
    const { supabase } = criarSupabaseFake(
      {
        modelos: { data: { id: "modelo-1", nome: "M", conteudo: "{{nome_cliente}}" }, error: null },
        fichas_caso: { data: { id: "ficha-1", nome_cliente: "Cliente X", area_direito: null, cliente_id: null }, error: null },
        prazos: { data: null, error: null },
        contratos_honorario: { data: null, error: null },
      },
      { erroInsertPeticoesGeradas: erroFake },
    );

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const resultado = await gerarDocumentoDaFicha(supabase, PARAMS_BASE);
    consoleErrorSpy.mockRestore();

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toMatch(/auditoria/i);
  });
});
