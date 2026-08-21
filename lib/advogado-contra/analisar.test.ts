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

const { analisarComoAdvogadoContra } = await import("./analisar");

const CITACAO_OK = { trechoOriginal: "Fls. 2, item III do pedido.", pagina: 2, certeza: "confirmado" as const };

function respostaAdvogadoContraValida(): Record<string, unknown> {
  return {
    teseIdentificada: "Rescisão contratual por inadimplemento.",
    resumoExecutivo: "Tese razoavelmente fundamentada, com pequenas lacunas na comprovação do dano.",
    argumentosContrarios: [
      { ...CITACAO_OK, descricao: "A parte adversária pode alegar decadência.", forca: "media" },
    ],
    fragilidades: [
      {
        ...CITACAO_OK,
        categoria: "fundamentacao",
        severidade: "moderada",
        descricao: "Fundamentação genérica.",
        sugestaoReforco: "Correlacionar dispositivo citado com o fato.",
      },
    ],
    contradicoes: [],
    precedentesContrariosProvaveis: [
      { descricao: "Tribunais costumam interpretar restritivamente esse tipo de cláusula.", areaJuridicaProvavel: "Consumidor", forca: "baixa" },
    ],
    pontosQueExigemProva: ["Não há comprovação documental do dano."],
    perguntasDificeis: ["Qual prova sustenta o valor do dano?"],
    recomendacoesFortalecimento: ["Anexar laudo pericial."],
    vulnerabilidadeGeral: "media",
    justificativaVulnerabilidade: "Fundamentação com lacunas pontuais.",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("analisarComoAdvogadoContra", () => {
  it("origem 'colado': não chama nenhuma extração, envia o texto colado direto no prompt", async () => {
    gerarRespostaEstruturadaMock.mockResolvedValueOnce(respostaAdvogadoContraValida());

    const resultado = await analisarComoAdvogadoContra({ origem: "colado", titulo: "Tese Caso X", texto: "Texto da tese colada." });

    expect(resultado.ok).toBe(true);
    expect(extrairTextoDePdfPorPaginaMock).not.toHaveBeenCalled();
    expect(extrairTextoDeDocxMock).not.toHaveBeenCalled();
    expect(gerarRespostaEstruturadaMock).toHaveBeenCalledTimes(1);
    const chamada = gerarRespostaEstruturadaMock.mock.calls[0]?.[0];
    expect(chamada.parteExtra).toBeNull();
    expect(chamada.promptTexto).toContain("Texto da tese colada.");
  });

  it("origem 'upload' com tipoArquivo 'pdf': extrai via extrairTextoDePdfPorPagina, nunca chama extrairTextoDeDocx", async () => {
    extrairTextoDePdfPorPaginaMock.mockResolvedValueOnce([{ pagina: 1, texto: "Conteúdo do PDF." }]);
    gerarRespostaEstruturadaMock.mockResolvedValueOnce(respostaAdvogadoContraValida());

    const resultado = await analisarComoAdvogadoContra({
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
    gerarRespostaEstruturadaMock.mockResolvedValueOnce(respostaAdvogadoContraValida());

    const resultado = await analisarComoAdvogadoContra({
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
    gerarRespostaEstruturadaMock.mockResolvedValueOnce(respostaAdvogadoContraValida());

    const resultado = await analisarComoAdvogadoContra({
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

  it("origem 'tese_cadastrada': não chama nenhuma extração, envia tese/fundamentacao no prompt", async () => {
    gerarRespostaEstruturadaMock.mockResolvedValueOnce(respostaAdvogadoContraValida());

    const resultado = await analisarComoAdvogadoContra({
      origem: "tese_cadastrada",
      tese: "A cláusula de fidelidade é abusiva.",
      fundamentacao: "Art. 51 do CDC.",
    });

    expect(resultado.ok).toBe(true);
    expect(extrairTextoDePdfPorPaginaMock).not.toHaveBeenCalled();
    expect(extrairTextoDeDocxMock).not.toHaveBeenCalled();
    const chamada = gerarRespostaEstruturadaMock.mock.calls[0]?.[0];
    expect(chamada.parteExtra).toBeNull();
    expect(chamada.promptTexto).toContain("A cláusula de fidelidade é abusiva.");
    expect(chamada.promptTexto).toContain("Art. 51 do CDC.");
  });

  it("erro de extração de PDF corrompido é tratado sem lançar exceção", async () => {
    extrairTextoDePdfPorPaginaMock.mockRejectedValueOnce(new Error("Não foi possível extrair texto do PDF."));

    const resultado = await analisarComoAdvogadoContra({
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

    const resultado = await analisarComoAdvogadoContra({ origem: "colado", titulo: null, texto: "Texto." });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.erro).toContain("formato inesperado");
  });

  it("guardrail CNJ: resposta com precedente contendo número de processo é tratada como falha de schema", async () => {
    gerarRespostaEstruturadaMock.mockResolvedValueOnce({
      ...respostaAdvogadoContraValida(),
      precedentesContrariosProvaveis: [
        { descricao: "Conforme REsp 1234567-89.2023.8.26.0100.", areaJuridicaProvavel: null, forca: "alta" },
      ],
    });

    const resultado = await analisarComoAdvogadoContra({ origem: "colado", titulo: null, texto: "Texto." });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.erro).toContain("formato inesperado");
  });

  it("guardrail de lastro: vulnerabilidadeGeral 'alta' sem achado que sustente é tratada como falha de schema", async () => {
    gerarRespostaEstruturadaMock.mockResolvedValueOnce({
      ...respostaAdvogadoContraValida(),
      vulnerabilidadeGeral: "alta",
      fragilidades: [
        { ...CITACAO_OK, categoria: "fundamentacao", severidade: "leve", descricao: "Fragilidade leve.", sugestaoReforco: null },
      ],
      contradicoes: [],
      argumentosContrarios: [{ ...CITACAO_OK, descricao: "Argumento fraco.", forca: "baixa" }],
    });

    const resultado = await analisarComoAdvogadoContra({ origem: "colado", titulo: null, texto: "Texto." });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.erro).toContain("formato inesperado");
  });

  it("erro lançado pela própria chamada de IA (ex: quota esgotada em toda a cadeia) é tratado sem propagar", async () => {
    gerarRespostaEstruturadaMock.mockRejectedValueOnce(new Error("429 quota esgotada em todos os modelos"));

    const resultado = await analisarComoAdvogadoContra({ origem: "colado", titulo: null, texto: "Texto." });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.erro).toContain("sobrecarregada");
      expect(resultado.erro).not.toContain("429");
    }
  });
});
