import { beforeEach, describe, expect, it, vi } from "vitest";

const gerarRespostaEstruturadaMock = vi.fn();
const extrairTextoDePdfPorPaginaMock = vi.fn();
const extrairTextoDeDocxMock = vi.fn();

vi.mock("../ia/chamada-estruturada", () => ({
  gerarRespostaEstruturada: gerarRespostaEstruturadaMock,
}));

vi.mock("../analise-processo/extracao", () => ({
  extrairTextoDePdfPorPagina: extrairTextoDePdfPorPaginaMock,
  extrairTextoDeDocx: extrairTextoDeDocxMock,
  truncarTextoExtraido: (paginas: { pagina: number | null; texto: string }[]) => ({
    paginas,
    truncado: false,
    tamanhoOriginal: paginas.reduce((total, pagina) => total + pagina.texto.length, 0),
  }),
}));

const { compararDocumentos } = await import("./comparar");

function respostaComparacaoValida(): Record<string, unknown> {
  return {
    resumoGeral: "A cláusula de multa foi alterada.",
    clausulas: [
      {
        tipoMudanca: "alterada",
        trechoA: "Multa de 5%.",
        paginaA: 1,
        trechoB: "Multa de 10%.",
        paginaB: 1,
        certeza: "confirmado",
        resumoMudanca: "Multa dobrou.",
        risco: "medio",
      },
    ],
    riscosIntroduzidos: [],
    recomendacoes: ["Negociar a redução da multa."],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

const PARAMETROS_BASE = {
  bufferA: Buffer.from("doc-a"),
  tipoArquivoA: "pdf" as const,
  nomeArquivoA: "contrato-v1.pdf",
  bufferB: Buffer.from("doc-b"),
  tipoArquivoB: "docx" as const,
  nomeArquivoB: "contrato-v2.docx",
};

describe("compararDocumentos", () => {
  it("extrai os 2 documentos pelo extrator correspondente ao tipoArquivo de cada lado", async () => {
    extrairTextoDePdfPorPaginaMock.mockResolvedValueOnce([{ pagina: 1, texto: "Conteúdo A." }]);
    extrairTextoDeDocxMock.mockResolvedValueOnce([{ pagina: null, texto: "Conteúdo B." }]);
    gerarRespostaEstruturadaMock.mockResolvedValueOnce(respostaComparacaoValida());

    const resultado = await compararDocumentos(PARAMETROS_BASE);

    expect(resultado.ok).toBe(true);
    expect(extrairTextoDePdfPorPaginaMock).toHaveBeenCalledTimes(1);
    expect(extrairTextoDeDocxMock).toHaveBeenCalledTimes(1);
    expect(gerarRespostaEstruturadaMock).toHaveBeenCalledTimes(1);
  });

  it("erro de extração do Documento A (PDF corrompido) é tratado sem lançar, identifica o lado A", async () => {
    extrairTextoDePdfPorPaginaMock.mockRejectedValueOnce(new Error("PDF sem camada de texto."));

    const resultado = await compararDocumentos(PARAMETROS_BASE);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.erro).toContain("Documento A");
    }
    expect(extrairTextoDeDocxMock).not.toHaveBeenCalled();
    expect(gerarRespostaEstruturadaMock).not.toHaveBeenCalled();
  });

  it("erro de extração do Documento B (DOCX vazio) é tratado sem lançar, identifica o lado B", async () => {
    extrairTextoDePdfPorPaginaMock.mockResolvedValueOnce([{ pagina: 1, texto: "Conteúdo A." }]);
    extrairTextoDeDocxMock.mockRejectedValueOnce(new Error("DOCX vazio ou sem conteúdo textual."));

    const resultado = await compararDocumentos(PARAMETROS_BASE);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.erro).toContain("Documento B");
    }
    expect(gerarRespostaEstruturadaMock).not.toHaveBeenCalled();
  });

  it("resposta da IA fora do schema (parse fail-closed) retorna erro claro, não lança exceção", async () => {
    extrairTextoDePdfPorPaginaMock.mockResolvedValueOnce([{ pagina: 1, texto: "Conteúdo A." }]);
    extrairTextoDeDocxMock.mockResolvedValueOnce([{ pagina: null, texto: "Conteúdo B." }]);
    gerarRespostaEstruturadaMock.mockResolvedValueOnce({ nada_a_ver: true });

    const resultado = await compararDocumentos(PARAMETROS_BASE);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.erro).toContain("formato inesperado");
    }
  });

  it("erro lançado pela própria chamada de IA é tratado sem propagar exceção não tratada", async () => {
    extrairTextoDePdfPorPaginaMock.mockResolvedValueOnce([{ pagina: 1, texto: "Conteúdo A." }]);
    extrairTextoDeDocxMock.mockResolvedValueOnce([{ pagina: null, texto: "Conteúdo B." }]);
    gerarRespostaEstruturadaMock.mockRejectedValueOnce(new Error("429 quota esgotada em todos os modelos"));

    const resultado = await compararDocumentos(PARAMETROS_BASE);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.erro).toContain("429 quota esgotada");
    }
  });
});
