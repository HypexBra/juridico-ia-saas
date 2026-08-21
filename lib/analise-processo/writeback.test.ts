import { describe, expect, it } from "vitest";
import {
  filtrarItensConfiaveis,
  inferirTipoPessoaCasoDoPapel,
  montarPessoaCasoDaAnaliseProcesso,
  montarPropostaPrazoDaAnaliseProcesso,
  montarResumoPropostaPrazoAnaliseProcesso,
  resolverDataEventoAnaliseProcesso,
  verificarPodeAplicarWriteback,
} from "./writeback";
import { montarTeseCasoDaAnaliseProcesso } from "@/lib/casos/teses";
import type {
  EventoAnaliseProcesso,
  PessoaAnaliseProcesso,
  PrazoIdentificadoAnaliseProcesso,
  TesePossivelAnaliseProcesso,
} from "./tipos";

function citacao<T extends Record<string, unknown>>(
  extra: T,
  certeza: "confirmado" | "inferido" | "nao_encontrado" = "confirmado",
) {
  return { trechoOriginal: "trecho de teste", pagina: 1, certeza, ...extra };
}

describe("verificarPodeAplicarWriteback", () => {
  it("bloqueia quando a análise ainda não está pronta", () => {
    const resultado = verificarPodeAplicarWriteback({
      status: "processando",
      writeback_aplicado_em: null,
      resultado_analise: null,
    });
    expect(resultado.ok).toBe(false);
  });

  it("bloqueia quando o write-back já foi aplicado antes (idempotência)", () => {
    const resultado = verificarPodeAplicarWriteback({
      status: "pronto",
      writeback_aplicado_em: "2026-08-20T10:00:00.000Z",
      resultado_analise: { resumoExecutivo: "x" },
    });
    expect(resultado.ok).toBe(false);
  });

  it("permite quando pronta, com resultado e nunca aplicada", () => {
    const resultado = verificarPodeAplicarWriteback({
      status: "pronto",
      writeback_aplicado_em: null,
      resultado_analise: { resumoExecutivo: "x" },
    });
    expect(resultado.ok).toBe(true);
  });
});

describe("filtrarItensConfiaveis", () => {
  it("remove itens com certeza 'nao_encontrado'", () => {
    const itens = [citacao({ id: 1 }, "confirmado"), citacao({ id: 2 }, "nao_encontrado"), citacao({ id: 3 }, "inferido")];
    const filtrados = filtrarItensConfiaveis(itens);
    expect(filtrados.map((i) => i.id)).toEqual([1, 3]);
  });
});

describe("inferirTipoPessoaCasoDoPapel", () => {
  it.each([
    ["Réu", "adverso"],
    ["Requerido na ação", "adverso"],
    ["Autor da ação", "parte"],
    ["Testemunha arrolada pela defesa", "testemunha"],
    ["Perito judicial", "terceiro"],
  ] as const)("mapeia \"%s\" para \"%s\"", (papel, esperado) => {
    expect(inferirTipoPessoaCasoDoPapel(papel)).toBe(esperado);
  });
});

describe("montarPessoaCasoDaAnaliseProcesso", () => {
  it("monta o input com tipo inferido e nome trimado", () => {
    const item: PessoaAnaliseProcesso = citacao({ nome: "  João Silva  ", papel: "Réu", documento: "123" });
    const input = montarPessoaCasoDaAnaliseProcesso(item);
    expect(input).toEqual({ tipo: "adverso", nome: "João Silva", documento: "123", contato: null, papelProcessual: "Réu" });
  });

  it("devolve null quando o nome está vazio", () => {
    const item: PessoaAnaliseProcesso = citacao({ nome: "   ", papel: "Réu", documento: null });
    expect(montarPessoaCasoDaAnaliseProcesso(item)).toBeNull();
  });
});

describe("resolverDataEventoAnaliseProcesso", () => {
  it("converte data YYYY-MM-DD válida para ISO", () => {
    const item: EventoAnaliseProcesso = citacao({ data: "2026-01-15", descricao: "Citação" });
    expect(resolverDataEventoAnaliseProcesso(item)).toBe("2026-01-15T00:00:00.000Z");
  });

  it("devolve null quando não há data", () => {
    const item: EventoAnaliseProcesso = citacao({ data: null, descricao: "Citação" });
    expect(resolverDataEventoAnaliseProcesso(item)).toBeNull();
  });

  it("devolve null quando a data não está em formato ISO", () => {
    const item: EventoAnaliseProcesso = citacao({ data: "15/01/2026", descricao: "Citação" });
    expect(resolverDataEventoAnaliseProcesso(item)).toBeNull();
  });
});

describe("montarPropostaPrazoDaAnaliseProcesso", () => {
  it("monta a proposta quando há título e data válidos", () => {
    const item: PrazoIdentificadoAnaliseProcesso = citacao({
      titulo: "Prazo para contestação",
      data: "2026-09-01",
      descricao: "15 dias a partir da citação",
    });
    const proposta = montarPropostaPrazoDaAnaliseProcesso(item, "peticao.pdf", "ficha-1");
    expect(proposta).not.toBeNull();
    expect(proposta?.dados).toEqual({
      titulo: "Prazo para contestação",
      descricao: "15 dias a partir da citação",
      data_prazo: "2026-09-01",
      ficha_caso_id: "ficha-1",
    });
    expect(proposta?.motivo).toContain("peticao.pdf");
  });

  it("devolve null quando não há data (nunca propõe prazo com data inventada)", () => {
    const item: PrazoIdentificadoAnaliseProcesso = citacao({
      titulo: "Prazo para contestação",
      data: null,
      descricao: "sem data explícita no documento",
    });
    expect(montarPropostaPrazoDaAnaliseProcesso(item, "peticao.pdf", "ficha-1")).toBeNull();
  });

  it("devolve null quando a data não está em formato ISO", () => {
    const item: PrazoIdentificadoAnaliseProcesso = citacao({
      titulo: "Prazo para contestação",
      data: "01/09/2026",
      descricao: "formato inválido",
    });
    expect(montarPropostaPrazoDaAnaliseProcesso(item, "peticao.pdf", "ficha-1")).toBeNull();
  });
});

describe("montarResumoPropostaPrazoAnaliseProcesso", () => {
  it("monta um resumo humano determinístico", () => {
    const resumo = montarResumoPropostaPrazoAnaliseProcesso({
      dados: { titulo: "Prazo X", descricao: "desc", data_prazo: "2026-09-01", ficha_caso_id: "ficha-1" },
      motivo: "Prazo identificado pela análise inteligente do documento \"peticao.pdf\".",
    });
    expect(resumo).toBe(
      'Criar prazo "Prazo X" para 2026-09-01 (Prazo identificado pela análise inteligente do documento "peticao.pdf".)',
    );
  });
});

describe("montarTeseCasoDaAnaliseProcesso", () => {
  it("monta tese e fundamentação trimadas", () => {
    const item: TesePossivelAnaliseProcesso = citacao({ tese: "  Tese X  ", fundamentacao: "  Fund Y  " });
    expect(montarTeseCasoDaAnaliseProcesso(item)).toEqual({ tese: "Tese X", fundamentacao: "Fund Y" });
  });

  it("devolve null quando a tese está vazia", () => {
    const item: TesePossivelAnaliseProcesso = citacao({ tese: "   ", fundamentacao: "Fund Y" });
    expect(montarTeseCasoDaAnaliseProcesso(item)).toBeNull();
  });
});
