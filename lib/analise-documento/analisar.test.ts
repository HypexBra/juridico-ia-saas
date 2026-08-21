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

const { analisarDocumento } = await import("./analisar");

const CITACAO_OK = { trechoOriginal: "Cláusula 3, item II.", pagina: 1, certeza: "confirmado" as const };

function respostaAnaliseDocumentoValida(): Record<string, unknown> {
  return {
    tipoDocumento: "contrato",
    resumoExecutivo: "Contrato de prestação de serviços entre as partes.",
    pontosChave: [{ ...CITACAO_OK, descricao: "Vigência de 12 meses." }],
    clausulas: [
      {
        ...CITACAO_OK,
        numero: 3,
        veredito: "ok" as const,
        problema: null,
        sugestao: null,
      },
    ],
    entidades: {
      datas: [{ ...CITACAO_OK, data: "2026-01-01", descricao: "Início da vigência." }],
      valores: [{ ...CITACAO_OK, valor: "R$ 5.000,00", descricao: "Valor mensal." }],
      partes: [{ ...CITACAO_OK, nome: "Empresa X", papel: "contratante" }],
    },
    inconsistencias: [],
    riscos: [{ ...CITACAO_OK, descricao: "Ausência de cláusula de rescisão.", nivel: "medio" as const }],
    informacoesAusentes: ["Não há cláusula de multa por atraso de pagamento."],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("analisarDocumento", () => {
  it("dispatch por tipoArquivo 'pdf': extrai via extrairTextoDePdfPorPagina, nunca chama extrairTextoDeDocx", async () => {
    extrairTextoDePdfPorPaginaMock.mockResolvedValueOnce([{ pagina: 1, texto: "Conteúdo do PDF." }]);
    gerarRespostaEstruturadaMock.mockResolvedValueOnce(respostaAnaliseDocumentoValida());

    const resultado = await analisarDocumento({
      buffer: Buffer.from("pdf-bytes"),
      tipoArquivo: "pdf",
      nomeArquivo: "contrato.pdf",
    });

    expect(resultado.ok).toBe(true);
    expect(extrairTextoDePdfPorPaginaMock).toHaveBeenCalledTimes(1);
    expect(extrairTextoDeDocxMock).not.toHaveBeenCalled();
    expect(gerarRespostaEstruturadaMock).toHaveBeenCalledTimes(1);
    const chamada = gerarRespostaEstruturadaMock.mock.calls[0]?.[0];
    expect(chamada.parteExtra).toBeNull();
  });

  it("dispatch por tipoArquivo 'docx': extrai via extrairTextoDeDocx, nunca chama extrairTextoDePdfPorPagina", async () => {
    extrairTextoDeDocxMock.mockResolvedValueOnce([{ pagina: null, texto: "Texto do docx." }]);
    gerarRespostaEstruturadaMock.mockResolvedValueOnce(respostaAnaliseDocumentoValida());

    const resultado = await analisarDocumento({
      buffer: Buffer.from("docx-bytes"),
      tipoArquivo: "docx",
      nomeArquivo: "peca.docx",
    });

    expect(resultado.ok).toBe(true);
    expect(extrairTextoDeDocxMock).toHaveBeenCalledTimes(1);
    expect(extrairTextoDePdfPorPaginaMock).not.toHaveBeenCalled();
  });

  it("dispatch por tipoArquivo 'imagem': não chama nenhuma extração de texto, envia parteExtra inlineData", async () => {
    gerarRespostaEstruturadaMock.mockResolvedValueOnce(respostaAnaliseDocumentoValida());

    const resultado = await analisarDocumento({
      buffer: Buffer.from("imagem-bytes"),
      tipoArquivo: "imagem",
      nomeArquivo: "foto.jpg",
    });

    expect(resultado.ok).toBe(true);
    expect(extrairTextoDePdfPorPaginaMock).not.toHaveBeenCalled();
    expect(extrairTextoDeDocxMock).not.toHaveBeenCalled();
    const chamada = gerarRespostaEstruturadaMock.mock.calls[0]?.[0];
    expect(chamada.parteExtra).toEqual({
      inlineData: { mimeType: "image/jpeg", data: Buffer.from("imagem-bytes").toString("base64") },
    });
  });

  it("erro de extração de PDF corrompido é tratado sem lançar exceção", async () => {
    extrairTextoDePdfPorPaginaMock.mockRejectedValueOnce(
      new Error("Não foi possível extrair texto do PDF (documento provavelmente digitalizado como imagem)."),
    );

    const resultado = await analisarDocumento({
      buffer: Buffer.from("pdf-corrompido"),
      tipoArquivo: "pdf",
      nomeArquivo: "corrompido.pdf",
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.erro).toContain("Não foi possível extrair texto do PDF");
    }
    expect(gerarRespostaEstruturadaMock).not.toHaveBeenCalled();
  });

  it("erro de extração de DOCX vazio é tratado sem lançar exceção", async () => {
    extrairTextoDeDocxMock.mockRejectedValueOnce(
      new Error("Não foi possível extrair texto do DOCX (documento vazio ou sem conteúdo textual)."),
    );

    const resultado = await analisarDocumento({
      buffer: Buffer.from(""),
      tipoArquivo: "docx",
      nomeArquivo: "vazio.docx",
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.erro).toContain("DOCX");
    }
    expect(gerarRespostaEstruturadaMock).not.toHaveBeenCalled();
  });

  it("resposta da IA fora do schema (parse fail-closed) retorna erro claro, não lança exceção", async () => {
    extrairTextoDePdfPorPaginaMock.mockResolvedValueOnce([{ pagina: 1, texto: "Conteúdo." }]);
    gerarRespostaEstruturadaMock.mockResolvedValueOnce({ campoTotalmenteInesperado: true });

    const resultado = await analisarDocumento({
      buffer: Buffer.from("pdf-bytes"),
      tipoArquivo: "pdf",
      nomeArquivo: "contrato.pdf",
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.erro).toContain("formato inesperado");
    }
  });

  it("erro lançado pela própria chamada de IA (ex: quota esgotada em toda a cadeia) é tratado sem propagar", async () => {
    extrairTextoDePdfPorPaginaMock.mockResolvedValueOnce([{ pagina: 1, texto: "Conteúdo." }]);
    gerarRespostaEstruturadaMock.mockRejectedValueOnce(new Error("429 quota esgotada em todos os modelos"));

    const resultado = await analisarDocumento({
      buffer: Buffer.from("pdf-bytes"),
      tipoArquivo: "pdf",
      nomeArquivo: "contrato.pdf",
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      // Erro de provider (quota/5xx) nunca vaza mensagem crua pro usuário —
      // ver lib/ia/erros.ts#mensagemErroIaParaUsuario.
      expect(resultado.erro).toContain("sobrecarregada");
      expect(resultado.erro).not.toContain("429");
    }
  });
});
