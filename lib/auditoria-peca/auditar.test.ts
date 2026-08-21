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
  TAMANHO_MAXIMO_TEXTO_ANALISE_PROCESSO: 300_000,
}));

const { auditarPeca } = await import("./auditar");

const CITACAO_OK = { trechoOriginal: "Fls. 2, item III do pedido.", pagina: 2, certeza: "confirmado" as const };

function respostaAuditoriaPecaValida(): Record<string, unknown> {
  return {
    tipoPeca: "petição inicial",
    resumoExecutivo: "Petição inicial bem estruturada, com pequenas lacunas na fundamentação.",
    notas: { fundamentacao: 7.5, coerencia: 8, pedidos: 6.4, jurisprudencia: 7 },
    veredictoRisco: "medio",
    justificativaRisco: "Fundamentação com lacunas pontuais que podem enfraquecer a tese.",
    achados: [
      {
        ...CITACAO_OK,
        categoria: "fundamentacao",
        severidade: "atencao",
        descricao: "Fundamentação genérica.",
        sugestao: "Correlacionar dispositivo citado com o fato.",
      },
    ],
    contraArgumentosProvaveis: [
      { ...CITACAO_OK, descricao: "Réu pode arguir prescrição.", forca: "media" as const },
    ],
    omissoesDetectadas: ["Não há menção à correção monetária."],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("auditarPeca", () => {
  it("origem 'colado': não chama nenhuma extração, envia o texto colado direto no prompt", async () => {
    gerarRespostaEstruturadaMock.mockResolvedValueOnce(respostaAuditoriaPecaValida());

    const resultado = await auditarPeca({ origem: "colado", titulo: "Petição Caso X", texto: "Texto da peça colada." });

    expect(resultado.ok).toBe(true);
    expect(extrairTextoDePdfPorPaginaMock).not.toHaveBeenCalled();
    expect(extrairTextoDeDocxMock).not.toHaveBeenCalled();
    expect(gerarRespostaEstruturadaMock).toHaveBeenCalledTimes(1);
    const chamada = gerarRespostaEstruturadaMock.mock.calls[0]?.[0];
    expect(chamada.parteExtra).toBeNull();
    expect(chamada.promptTexto).toContain("Texto da peça colada.");
  });

  it("origem 'upload' com tipoArquivo 'pdf': extrai via extrairTextoDePdfPorPagina, nunca chama extrairTextoDeDocx", async () => {
    extrairTextoDePdfPorPaginaMock.mockResolvedValueOnce([{ pagina: 1, texto: "Conteúdo do PDF." }]);
    gerarRespostaEstruturadaMock.mockResolvedValueOnce(respostaAuditoriaPecaValida());

    const resultado = await auditarPeca({
      origem: "upload",
      titulo: null,
      buffer: Buffer.from("pdf-bytes"),
      tipoArquivo: "pdf",
      nomeArquivo: "peca.pdf",
    });

    expect(resultado.ok).toBe(true);
    expect(extrairTextoDePdfPorPaginaMock).toHaveBeenCalledTimes(1);
    expect(extrairTextoDeDocxMock).not.toHaveBeenCalled();
    const chamada = gerarRespostaEstruturadaMock.mock.calls[0]?.[0];
    expect(chamada.parteExtra).toBeNull();
  });

  it("origem 'upload' com tipoArquivo 'docx': extrai via extrairTextoDeDocx, nunca chama extrairTextoDePdfPorPagina", async () => {
    extrairTextoDeDocxMock.mockResolvedValueOnce([{ pagina: null, texto: "Texto do docx." }]);
    gerarRespostaEstruturadaMock.mockResolvedValueOnce(respostaAuditoriaPecaValida());

    const resultado = await auditarPeca({
      origem: "upload",
      titulo: null,
      buffer: Buffer.from("docx-bytes"),
      tipoArquivo: "docx",
      nomeArquivo: "peca.docx",
    });

    expect(resultado.ok).toBe(true);
    expect(extrairTextoDeDocxMock).toHaveBeenCalledTimes(1);
    expect(extrairTextoDePdfPorPaginaMock).not.toHaveBeenCalled();
  });

  it("origem 'upload' com tipoArquivo 'imagem': não chama extração de texto, envia parteExtra inlineData", async () => {
    gerarRespostaEstruturadaMock.mockResolvedValueOnce(respostaAuditoriaPecaValida());

    const resultado = await auditarPeca({
      origem: "upload",
      titulo: null,
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
    extrairTextoDePdfPorPaginaMock.mockRejectedValueOnce(new Error("Não foi possível extrair texto do PDF."));

    const resultado = await auditarPeca({
      origem: "upload",
      titulo: null,
      buffer: Buffer.from("pdf-corrompido"),
      tipoArquivo: "pdf",
      nomeArquivo: "corrompido.pdf",
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.erro).toContain("Não foi possível extrair texto do PDF");
    expect(gerarRespostaEstruturadaMock).not.toHaveBeenCalled();
  });

  it("resposta da IA fora do schema (parse fail-closed) retorna erro claro, não lança exceção", async () => {
    gerarRespostaEstruturadaMock.mockResolvedValueOnce({ campoTotalmenteInesperado: true });

    const resultado = await auditarPeca({ origem: "colado", titulo: null, texto: "Texto." });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.erro).toContain("formato inesperado");
  });

  it("erro lançado pela própria chamada de IA (ex: quota esgotada em toda a cadeia) é tratado sem propagar", async () => {
    gerarRespostaEstruturadaMock.mockRejectedValueOnce(new Error("429 quota esgotada em todos os modelos"));

    const resultado = await auditarPeca({ origem: "colado", titulo: null, texto: "Texto." });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.erro).toContain("sobrecarregada");
      expect(resultado.erro).not.toContain("429");
    }
  });
});
