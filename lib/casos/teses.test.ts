import { describe, expect, it } from "vitest";
import {
  montarAtualizacaoStatusTese,
  montarNovaTeseCaso,
  montarTeseCasoDaAnaliseIa,
} from "./teses";
import type { EntradaHistoricoTeseCaso } from "@/lib/types";

describe("montarNovaTeseCaso", () => {
  it("monta o payload com status inicial em_avaliacao e uma entrada de histórico", () => {
    const payload = montarNovaTeseCaso({
      escritorioId: "escritorio-1",
      fichaCasoId: "ficha-1",
      tese: "  Prescrição intercorrente da execução  ",
      fundamentacao: "  Art. 921, §4º, CPC  ",
    });

    expect(payload.status).toBe("em_avaliacao");
    expect(payload.tese).toBe("Prescrição intercorrente da execução");
    expect(payload.fundamentacao).toBe("Art. 921, §4º, CPC");
    expect(payload.historico).toHaveLength(1);
    expect(payload.historico[0]?.status_anterior).toBeNull();
    expect(payload.historico[0]?.status_novo).toBe("em_avaliacao");
  });

  it("trata fundamentacao vazia/whitespace como null", () => {
    const payload = montarNovaTeseCaso({
      escritorioId: "escritorio-1",
      fichaCasoId: "ficha-1",
      tese: "Tese X",
      fundamentacao: "   ",
    });

    expect(payload.fundamentacao).toBeNull();
  });

  it("lança erro quando a tese é vazia após trim", () => {
    expect(() =>
      montarNovaTeseCaso({
        escritorioId: "escritorio-1",
        fichaCasoId: "ficha-1",
        tese: "   ",
        fundamentacao: null,
      }),
    ).toThrow();
  });
});

describe("montarTeseCasoDaAnaliseIa", () => {
  it("retorna null quando a IA não produziu estratégia", () => {
    const resultado = montarTeseCasoDaAnaliseIa({
      areaDireito: "Trabalhista",
      estrategiaIa: null,
      questoesIa: "- Questão 1",
    });

    expect(resultado).toBeNull();
  });

  it("prefixa a tese com a área do direito quando conhecida", () => {
    const resultado = montarTeseCasoDaAnaliseIa({
      areaDireito: "Trabalhista",
      estrategiaIa: "Recomenda-se ajuizar reclamação por verbas rescisórias.",
      questoesIa: "- Vínculo empregatício\n- Horas extras",
    });

    expect(resultado?.tese).toBe(
      "[Trabalhista] Recomenda-se ajuizar reclamação por verbas rescisórias.",
    );
    expect(resultado?.fundamentacao).toBe("- Vínculo empregatício\n- Horas extras");
  });

  it("não prefixa quando a área do direito não é informada", () => {
    const resultado = montarTeseCasoDaAnaliseIa({
      areaDireito: null,
      estrategiaIa: "Estratégia sem área definida.",
      questoesIa: null,
    });

    expect(resultado?.tese).toBe("Estratégia sem área definida.");
    expect(resultado?.fundamentacao).toBeNull();
  });

  it("trunca a tese em 4000 caracteres para não exceder limites razoáveis de coluna", () => {
    const estrategiaGigante = "A".repeat(5000);
    const resultado = montarTeseCasoDaAnaliseIa({
      areaDireito: null,
      estrategiaIa: estrategiaGigante,
      questoesIa: null,
    });

    expect(resultado?.tese).toHaveLength(4000);
  });
});

describe("montarAtualizacaoStatusTese", () => {
  it("preserva o histórico anterior e adiciona uma nova entrada ao adotar a tese", () => {
    const historicoAtual: EntradaHistoricoTeseCaso[] = [
      { em: "2026-01-01T00:00:00.000Z", status_anterior: null, status_novo: "em_avaliacao", nota: "Tese registrada." },
    ];

    const resultado = montarAtualizacaoStatusTese({
      statusAtual: "em_avaliacao",
      historicoAtual,
      novoStatus: "adotada",
      nota: "Advogado decidiu seguir com esta linha.",
    });

    expect(resultado.status).toBe("adotada");
    expect(resultado.historico).toHaveLength(2);
    expect(resultado.historico[0]).toEqual(historicoAtual[0]);
    expect(resultado.historico[1]?.status_anterior).toBe("em_avaliacao");
    expect(resultado.historico[1]?.status_novo).toBe("adotada");
    expect(resultado.historico[1]?.nota).toBe("Advogado decidiu seguir com esta linha.");
  });

  it("não mutila o array de histórico original (imutabilidade)", () => {
    const historicoAtual: EntradaHistoricoTeseCaso[] = [
      { em: "2026-01-01T00:00:00.000Z", status_anterior: null, status_novo: "em_avaliacao", nota: null },
    ];

    montarAtualizacaoStatusTese({
      statusAtual: "em_avaliacao",
      historicoAtual,
      novoStatus: "descartada",
    });

    expect(historicoAtual).toHaveLength(1);
  });

  it("lança erro ao tentar 'atualizar' para o mesmo status atual", () => {
    expect(() =>
      montarAtualizacaoStatusTese({
        statusAtual: "adotada",
        historicoAtual: [],
        novoStatus: "adotada",
      }),
    ).toThrow();
  });

  it("registra nota null quando nenhuma nota é informada", () => {
    const resultado = montarAtualizacaoStatusTese({
      statusAtual: "em_avaliacao",
      historicoAtual: [],
      novoStatus: "descartada",
    });

    expect(resultado.historico[0]?.nota).toBeNull();
  });
});
