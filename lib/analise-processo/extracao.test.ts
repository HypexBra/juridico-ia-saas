import { describe, expect, it, vi } from "vitest";

const extractTextMock = vi.fn();
const getDocumentProxyMock = vi.fn();
const extractRawTextMock = vi.fn();

vi.mock("unpdf", () => ({
  extractText: (...args: unknown[]) => extractTextMock(...args),
  getDocumentProxy: (...args: unknown[]) => getDocumentProxyMock(...args),
}));

vi.mock("mammoth", () => ({
  default: { extractRawText: (...args: unknown[]) => extractRawTextMock(...args) },
}));

const { extrairTextoDeDocx, extrairTextoDePdfPorPagina, truncarTextoExtraido, TAMANHO_MAXIMO_TEXTO_ANALISE_PROCESSO } =
  await import("./extracao");

describe("extrairTextoDePdfPorPagina", () => {
  it("retorna um item por página, 1-based, com texto aparado", async () => {
    getDocumentProxyMock.mockResolvedValueOnce({});
    extractTextMock.mockResolvedValueOnce({ text: ["  Página um.  ", "Página dois."] });

    const paginas = await extrairTextoDePdfPorPagina(new Uint8Array());

    expect(paginas).toEqual([
      { pagina: 1, texto: "Página um." },
      { pagina: 2, texto: "Página dois." },
    ]);
    expect(extractTextMock).toHaveBeenCalledWith({}, { mergePages: false });
  });

  it("lança erro explícito quando nenhuma página tem texto extraível (PDF escaneado)", async () => {
    getDocumentProxyMock.mockResolvedValueOnce({});
    extractTextMock.mockResolvedValueOnce({ text: ["", "   "] });

    await expect(extrairTextoDePdfPorPagina(new Uint8Array())).rejects.toThrow(/digitalizado como imagem/);
  });
});

describe("extrairTextoDeDocx", () => {
  it("retorna uma única entrada com pagina null (DOCX não tem paginação real)", async () => {
    extractRawTextMock.mockResolvedValueOnce({ value: "  Texto corrido do docx.  ", messages: [] });

    const paginas = await extrairTextoDeDocx(Buffer.from("qualquer"));

    expect(paginas).toEqual([{ pagina: null, texto: "Texto corrido do docx." }]);
  });

  it("lança erro explícito quando o DOCX não tem conteúdo textual", async () => {
    extractRawTextMock.mockResolvedValueOnce({ value: "   ", messages: [] });

    await expect(extrairTextoDeDocx(Buffer.from("qualquer"))).rejects.toThrow(/vazio ou sem conteúdo/);
  });
});

describe("truncarTextoExtraido", () => {
  it("não trunca quando o total está dentro do limite", () => {
    const paginas = [{ pagina: 1, texto: "abc" }];
    const resultado = truncarTextoExtraido(paginas);

    expect(resultado.truncado).toBe(false);
    expect(resultado.paginas).toEqual(paginas);
  });

  it("trunca por página inteira quando excede o teto, sem cortar página no meio", () => {
    const pagina1 = { pagina: 1, texto: "a".repeat(TAMANHO_MAXIMO_TEXTO_ANALISE_PROCESSO - 10) };
    const pagina2 = { pagina: 2, texto: "b".repeat(50) };

    const resultado = truncarTextoExtraido([pagina1, pagina2]);

    expect(resultado.truncado).toBe(true);
    expect(resultado.paginas).toEqual([pagina1]);
    expect(resultado.tamanhoOriginal).toBe(pagina1.texto.length + pagina2.texto.length);
  });
});
