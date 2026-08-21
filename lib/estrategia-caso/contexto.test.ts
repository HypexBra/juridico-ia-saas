import { describe, expect, it } from "vitest";
import {
  montarContextoEstrategiaCaso,
  type DadosContextoEstrategiaCaso,
  type FichaContextoEstrategia,
} from "./contexto";

function fichaBase(overrides: Partial<FichaContextoEstrategia> = {}): FichaContextoEstrategia {
  return {
    resumoFatos: "Cliente contratou serviço e não recebeu o produto.",
    areaDireito: "Direito do Consumidor",
    urgencia: "normal",
    statusProcessual: "em_andamento",
    resumoIa: null,
    questoesIa: null,
    estrategiaIa: null,
    ...overrides,
  };
}

function dadosVazios(overrides: Partial<DadosContextoEstrategiaCaso> = {}): DadosContextoEstrategiaCaso {
  return {
    ficha: fichaBase(),
    teses: [],
    eventos: [],
    pessoas: [],
    jurisprudenciasCitadas: [],
    resumosAnalises: [],
    ...overrides,
  };
}

describe("montarContextoEstrategiaCaso", () => {
  it("contexto completo: inclui todas as seções na ordem de prioridade (ficha -> teses -> eventos -> pessoas -> jurisprudência -> resumos -> legado)", () => {
    const dados = dadosVazios({
      ficha: fichaBase({ resumoIa: "resumo legado", questoesIa: "questão legada", estrategiaIa: "estratégia legada" }),
      teses: [
        { id: "tese-1", tese: "Tese principal", fundamentacao: "Fund. 1", status: "adotada", atualizadoEm: "2026-01-01" },
      ],
      eventos: [{ id: "evento-1", tipoEvento: "audiencia", descricao: "Audiência realizada", dataEvento: "2026-02-01" }],
      pessoas: [{ id: "pessoa-1", tipo: "parte", nome: "João da Silva", papelProcessual: "autor" }],
      jurisprudenciasCitadas: [
        { id: "juris-1", tribunal: "stj", numeroProcesso: "123", ementa: "Ementa de teste", notaAdvogado: null },
      ],
      resumosAnalises: [
        { id: "analise-1", tipo: "analise_processo", resumoExecutivo: "Resumo da análise", criadoEm: "2026-01-15" },
      ],
    });

    const contexto = montarContextoEstrategiaCaso(dados);

    const indiceFicha = contexto.indexOf("=== FICHA DO CASO ===");
    const indiceTeses = contexto.indexOf("=== TESES JÁ CADASTRADAS DO CASO");
    const indiceEventos = contexto.indexOf("=== ÚLTIMOS EVENTOS DA LINHA DO TEMPO");
    const indicePessoas = contexto.indexOf("=== PESSOAS ENVOLVIDAS NO CASO ===");
    const indiceJurisprudencias = contexto.indexOf("=== JURISPRUDÊNCIA JÁ CITADA NO CASO ===");
    const indiceResumos = contexto.indexOf("=== RESUMOS DE ANÁLISES DE IA");
    const indiceLegado = contexto.indexOf("=== CONTEXTO LEGADO DE BAIXA PRIORIDADE");

    expect(indiceFicha).toBe(0);
    expect(indiceTeses).toBeGreaterThan(indiceFicha);
    expect(indiceEventos).toBeGreaterThan(indiceTeses);
    expect(indicePessoas).toBeGreaterThan(indiceEventos);
    expect(indiceJurisprudencias).toBeGreaterThan(indicePessoas);
    expect(indiceResumos).toBeGreaterThan(indiceJurisprudencias);
    expect(indiceLegado).toBeGreaterThan(indiceResumos);

    expect(contexto).toContain("[id: tese-1]");
    expect(contexto).toContain("Audiência realizada");
    expect(contexto).toContain("João da Silva");
    expect(contexto).toContain("Ementa de teste");
    expect(contexto).toContain("Resumo da análise");
    expect(contexto).toContain("resumo legado");
  });

  it("caso novo (só ficha, sem teses/eventos/pessoas/jurisprudência/análises): monta só a seção da ficha", () => {
    const contexto = montarContextoEstrategiaCaso(dadosVazios());

    expect(contexto).toContain("=== FICHA DO CASO ===");
    expect(contexto).not.toContain("=== TESES");
    expect(contexto).not.toContain("=== ÚLTIMOS EVENTOS");
    expect(contexto).not.toContain("=== PESSOAS");
    expect(contexto).not.toContain("=== JURISPRUDÊNCIA");
    expect(contexto).not.toContain("=== RESUMOS");
    expect(contexto).not.toContain("=== CONTEXTO LEGADO");
  });

  it("trunca por SEÇÃO INTEIRA quando excede o teto injetado — nunca corta uma tese no meio", () => {
    const teseGrande1 = "A".repeat(200);
    const teseGrande2 = "B".repeat(200);
    const dados = dadosVazios({
      teses: [
        { id: "tese-1", tese: teseGrande1, fundamentacao: null, status: "em_avaliacao", atualizadoEm: "2026-01-02" },
        { id: "tese-2", tese: teseGrande2, fundamentacao: null, status: "em_avaliacao", atualizadoEm: "2026-01-01" },
      ],
      eventos: [{ id: "evento-1", tipoEvento: "peticao", descricao: "Evento qualquer", dataEvento: "2026-01-01" }],
    });

    // Teto pequeno o bastante para caber a ficha + a seção de teses inteira,
    // mas não a seção de eventos também.
    const tamanhoFicha = montarContextoEstrategiaCaso(dadosVazios()).length;
    const contextoComTeses = montarContextoEstrategiaCaso(dadosVazios({ teses: dados.teses }));
    const tetoQueCabeSoTeses = contextoComTeses.length + 5;

    const contexto = montarContextoEstrategiaCaso(dados, tetoQueCabeSoTeses);

    expect(contexto).toContain("=== FICHA DO CASO ===");
    expect(contexto).toContain(teseGrande1);
    expect(contexto).toContain(teseGrande2);
    // A seção de teses nunca é cortada no meio: ou está inteira, ou não está.
    expect(contexto).not.toContain("=== ÚLTIMOS EVENTOS DA LINHA DO TEMPO");
    expect(tamanhoFicha).toBeLessThan(tetoQueCabeSoTeses);
  });

  it("teto extremamente pequeno: sempre inclui a ficha inteira mesmo que ela sozinha exceda o teto", () => {
    const contexto = montarContextoEstrategiaCaso(dadosVazios(), 10);

    expect(contexto).toContain("=== FICHA DO CASO ===");
    expect(contexto.length).toBeGreaterThan(10);
  });

  it("limita eventos aos mais recentes (ordenação desc por dataEvento)", () => {
    const eventos = Array.from({ length: 35 }, (_, indice) => ({
      id: `evento-${indice}`,
      tipoEvento: "manual",
      descricao: `Evento número ${indice}`,
      dataEvento: `2026-01-${String(indice + 1).padStart(2, "0")}`,
    }));

    const contexto = montarContextoEstrategiaCaso(dadosVazios({ eventos }));

    expect(contexto).toContain("Evento número 34"); // mais recente
    expect(contexto).not.toContain("Evento número 0"); // mais antigo, fora do top 30
  });
});
