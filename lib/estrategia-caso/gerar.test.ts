import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DadosContextoEstrategiaCaso } from "./contexto";

const gerarRespostaEstruturadaMock = vi.fn();

vi.mock("../ia/chamada-estruturada", () => ({
  gerarRespostaEstruturada: gerarRespostaEstruturadaMock,
}));

const { gerarEstrategiaCaso } = await import("./gerar");

function dadosBase(overrides: Partial<DadosContextoEstrategiaCaso> = {}): DadosContextoEstrategiaCaso {
  return {
    ficha: {
      resumoFatos: "Cliente contratou serviço e não recebeu o produto.",
      areaDireito: "Direito do Consumidor",
      urgencia: "normal",
      statusProcessual: "em_andamento",
      resumoIa: null,
      questoesIa: null,
      estrategiaIa: null,
    },
    teses: [{ id: "tese-1", tese: "Rescisão contratual", fundamentacao: "Inadimplemento", status: "adotada", atualizadoEm: "2026-01-01" }],
    eventos: [],
    pessoas: [],
    jurisprudenciasCitadas: [],
    resumosAnalises: [],
    ...overrides,
  };
}

function respostaEstrategiaValida(): Record<string, unknown> {
  return {
    objetivo: "Obter a rescisão do contrato com devolução integral dos valores pagos.",
    teses: [{ origem: "tese_cadastrada", papel: "principal", teseCasoId: "tese-1", tese: null, fundamentacao: null }],
    provas: [],
    riscos: [],
    oportunidades: [],
    proximosPassos: [],
    acoesRecomendadas: [],
    ressalvas: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("gerarEstrategiaCaso", () => {
  it("sucesso: monta contexto/prompt, chama gerarRespostaEstruturada sem parteExtra e retorna resultado + contextoResumo", async () => {
    gerarRespostaEstruturadaMock.mockResolvedValueOnce(respostaEstrategiaValida());

    const resultado = await gerarEstrategiaCaso({ dados: dadosBase() });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.resultado.objetivo).toContain("rescisão do contrato");
    expect(resultado.contextoResumo).toEqual({
      totalTeses: 1,
      totalEventos: 0,
      totalPessoas: 0,
      totalJurisprudencias: 0,
      totalAnalisesConsideradas: 0,
    });
    expect(resultado.modeloIaUsado).toBe("gemini-flash-latest");

    expect(gerarRespostaEstruturadaMock).toHaveBeenCalledTimes(1);
    const chamada = gerarRespostaEstruturadaMock.mock.calls[0]?.[0];
    expect(chamada.parteExtra).toBeNull();
    expect(chamada.promptTexto).toContain("=== FICHA DO CASO ===");
    expect(chamada.promptTexto).toContain("tese-1");
  });

  it("contextoResumo reflete contadores reais mesmo quando a IA falha (não vem da resposta da IA)", async () => {
    gerarRespostaEstruturadaMock.mockRejectedValueOnce(new Error("Falha qualquer"));

    const resultado = await gerarEstrategiaCaso({ dados: dadosBase() });

    expect(resultado.ok).toBe(false);
  });

  it("resposta da IA fora do schema (parse fail-closed) retorna erro claro, não lança exceção", async () => {
    gerarRespostaEstruturadaMock.mockResolvedValueOnce({ campoTotalmenteInesperado: true });

    const resultado = await gerarEstrategiaCaso({ dados: dadosBase() });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.erro).toContain("formato inesperado");
  });

  it("teseCasoId inventado pela IA (fora da lista de ids reais do caso) é rejeitado — retorna erro, não persiste referência quebrada", async () => {
    const resposta = respostaEstrategiaValida();
    resposta.teses = [
      { origem: "tese_cadastrada", papel: "principal", teseCasoId: "tese-alucinada", tese: null, fundamentacao: null },
    ];
    gerarRespostaEstruturadaMock.mockResolvedValueOnce(resposta);

    const resultado = await gerarEstrategiaCaso({ dados: dadosBase() });

    expect(resultado.ok).toBe(false);
  });

  it("erro lançado pela própria chamada de IA (ex: quota esgotada em toda a cadeia) é tratado sem propagar e sem vazar detalhe técnico", async () => {
    gerarRespostaEstruturadaMock.mockRejectedValueOnce(new Error("429 quota esgotada em todos os modelos"));

    const resultado = await gerarEstrategiaCaso({ dados: dadosBase() });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.erro).toContain("sobrecarregada");
      expect(resultado.erro).not.toContain("429");
    }
  });
});
