import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Débito de teste pendente desde o ADR 0004 (Onda 1), fechado pela Onda 3 do
 * ADR 0011: `analisarDocumentoProcesso` nunca teve teste próprio, apesar de
 * ter sido refatorado para delegar em `lib/ia/chamada-estruturada.ts`
 * (extração de `chamarGeminiComSchema`, ver ADR 0011 seção 3). Este é um
 * teste de REGRESSÃO pós-refatoração: confirma que o comportamento externo
 * (dispatch por tipoArquivo, tratamento de erro fail-closed) continua
 * idêntico ao daquele antes da extração — não testa a lógica de retry em si
 * (isso é coberto por `lib/ia/chamada-estruturada.test.ts`).
 */

const gerarRespostaEstruturadaMock = vi.fn();
const extrairTextoDePdfPorPaginaMock = vi.fn();
const extrairTextoDeDocxMock = vi.fn();

vi.mock("../ia/chamada-estruturada", () => ({
  gerarRespostaEstruturada: gerarRespostaEstruturadaMock,
}));

vi.mock("./extracao", () => ({
  extrairTextoDePdfPorPagina: extrairTextoDePdfPorPaginaMock,
  extrairTextoDeDocx: extrairTextoDeDocxMock,
  truncarTextoExtraido: (paginas: { pagina: number | null; texto: string }[]) => ({
    paginas,
    truncado: false,
    tamanhoOriginal: paginas.reduce((total, pagina) => total + pagina.texto.length, 0),
  }),
}));

const { analisarDocumentoProcesso } = await import("./analisar");

const CITACAO_OK = { trechoOriginal: "Fls. 3, intimação publicada em 10/01/2026.", pagina: 3, certeza: "confirmado" as const };

function respostaAnaliseProcessoValida(): Record<string, unknown> {
  return {
    resumoExecutivo: "Ação de cobrança em fase inicial, réu ainda não citado.",
    linhaDoTempo: [{ ...CITACAO_OK, data: "2026-01-10", descricao: "Intimação publicada." }],
    pessoasPartes: [{ ...CITACAO_OK, nome: "João da Silva", papel: "réu", documento: null }],
    documentosEncontrados: [{ ...CITACAO_OK, tipo: "petição inicial", descricao: "Petição inicial protocolada." }],
    questoesJuridicas: [{ ...CITACAO_OK, questao: "Prescrição da dívida." }],
    tesesPossiveis: [{ ...CITACAO_OK, tese: "Prescrição consumada.", fundamentacao: "Mais de 5 anos desde o vencimento." }],
    evidencias: [{ ...CITACAO_OK, descricao: "Contrato assinado anexado." }],
    contradicoes: [{ ...CITACAO_OK, descricao: "Datas divergentes entre petição e anexo." }],
    informacoesAusentes: ["Não há comprovante de citação do réu no processo."],
    riscos: [{ ...CITACAO_OK, descricao: "Risco de revelia não configurada corretamente.", nivel: "medio" as const }],
    prazosIdentificados: [
      { ...CITACAO_OK, titulo: "Prazo para resposta", data: "2026-02-10", descricao: "15 dias após citação." },
    ],
    proximasAcoes: [{ ...CITACAO_OK, acao: "Verificar certidão de citação nos autos." }],
    perguntasInvestigar: [{ ...CITACAO_OK, pergunta: "O réu já foi efetivamente citado?" }],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("analisarDocumentoProcesso", () => {
  it("dispatch por tipoArquivo 'pdf': extrai via extrairTextoDePdfPorPagina, nunca chama extrairTextoDeDocx", async () => {
    extrairTextoDePdfPorPaginaMock.mockResolvedValueOnce([{ pagina: 1, texto: "Conteúdo do processo." }]);
    gerarRespostaEstruturadaMock.mockResolvedValueOnce(respostaAnaliseProcessoValida());

    const resultado = await analisarDocumentoProcesso({
      buffer: Buffer.from("pdf-bytes"),
      tipoArquivo: "pdf",
      nomeArquivo: "processo.pdf",
    });

    expect(resultado.ok).toBe(true);
    expect(extrairTextoDePdfPorPaginaMock).toHaveBeenCalledTimes(1);
    expect(extrairTextoDeDocxMock).not.toHaveBeenCalled();
    expect(gerarRespostaEstruturadaMock).toHaveBeenCalledTimes(1);
    const chamada = gerarRespostaEstruturadaMock.mock.calls[0]?.[0];
    expect(chamada.parteExtra).toBeNull();
  });

  it("dispatch por tipoArquivo 'docx': extrai via extrairTextoDeDocx, nunca chama extrairTextoDePdfPorPagina", async () => {
    extrairTextoDeDocxMock.mockResolvedValueOnce([{ pagina: null, texto: "Texto da peça." }]);
    gerarRespostaEstruturadaMock.mockResolvedValueOnce(respostaAnaliseProcessoValida());

    const resultado = await analisarDocumentoProcesso({
      buffer: Buffer.from("docx-bytes"),
      tipoArquivo: "docx",
      nomeArquivo: "peca.docx",
    });

    expect(resultado.ok).toBe(true);
    expect(extrairTextoDeDocxMock).toHaveBeenCalledTimes(1);
    expect(extrairTextoDePdfPorPaginaMock).not.toHaveBeenCalled();
  });

  it("dispatch por tipoArquivo 'imagem': não chama nenhuma extração de texto, envia parteExtra inlineData", async () => {
    gerarRespostaEstruturadaMock.mockResolvedValueOnce(respostaAnaliseProcessoValida());

    const resultado = await analisarDocumentoProcesso({
      buffer: Buffer.from("imagem-bytes"),
      tipoArquivo: "imagem",
      nomeArquivo: "foto.png",
    });

    expect(resultado.ok).toBe(true);
    expect(extrairTextoDePdfPorPaginaMock).not.toHaveBeenCalled();
    expect(extrairTextoDeDocxMock).not.toHaveBeenCalled();
    const chamada = gerarRespostaEstruturadaMock.mock.calls[0]?.[0];
    expect(chamada.parteExtra).toEqual({
      inlineData: { mimeType: "image/png", data: Buffer.from("imagem-bytes").toString("base64") },
    });
  });

  it("erro de extração (PDF corrompido) é tratado sem lançar exceção, mesmo padrão de antes da refatoração", async () => {
    extrairTextoDePdfPorPaginaMock.mockRejectedValueOnce(
      new Error("Não foi possível extrair texto do PDF (documento provavelmente digitalizado como imagem)."),
    );

    const resultado = await analisarDocumentoProcesso({
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

  it("resposta da IA fora do schema (parse fail-closed) retorna erro claro, não lança exceção", async () => {
    extrairTextoDePdfPorPaginaMock.mockResolvedValueOnce([{ pagina: 1, texto: "Conteúdo." }]);
    gerarRespostaEstruturadaMock.mockResolvedValueOnce({ campoTotalmenteInesperado: true });

    const resultado = await analisarDocumentoProcesso({
      buffer: Buffer.from("pdf-bytes"),
      tipoArquivo: "pdf",
      nomeArquivo: "processo.pdf",
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.erro).toContain("formato inesperado");
    }
  });

  it("erro lançado pela própria chamada de IA (ex: quota esgotada em toda a cadeia) é tratado sem propagar", async () => {
    extrairTextoDePdfPorPaginaMock.mockResolvedValueOnce([{ pagina: 1, texto: "Conteúdo." }]);
    gerarRespostaEstruturadaMock.mockRejectedValueOnce(new Error("429 quota esgotada em todos os modelos"));

    const resultado = await analisarDocumentoProcesso({
      buffer: Buffer.from("pdf-bytes"),
      tipoArquivo: "pdf",
      nomeArquivo: "processo.pdf",
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.erro).toContain("sobrecarregada");
      expect(resultado.erro).not.toContain("429");
    }
  });
});
