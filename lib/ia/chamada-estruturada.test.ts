import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { generateContentMock, googleGenAIConstructorMock } = vi.hoisted(() => ({
  generateContentMock: vi.fn(),
  googleGenAIConstructorMock: vi.fn(),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    constructor(...args: unknown[]) {
      googleGenAIConstructorMock(...args);
    }
    models = { generateContent: generateContentMock };
  },
}));

const { gerarRespostaEstruturada } = await import("./chamada-estruturada");

const PARAMETROS_BASE = {
  promptTexto: "Analise o documento.",
  parteExtra: null,
  systemPrompt: "Você é um assistente jurídico.",
  // Não usamos o tipo `Schema` real do SDK aqui de propósito — a função só
  // repassa este valor para `generateContent`, nunca inspeciona seu formato.
  responseSchema: {} as never,
  maxOutputTokens: 8192,
  thinkingBudget: 1024,
};

function respostaGeminiComTexto(objeto: unknown) {
  return { text: JSON.stringify(objeto) };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  process.env.GEMINI_API_KEY = "chave-de-teste";
});

afterEach(() => {
  vi.useRealTimers();
});

describe("gerarRespostaEstruturada", () => {
  it("erro transiente (503) tenta de novo no mesmo modelo e retorna sucesso na segunda tentativa", async () => {
    generateContentMock
      .mockImplementationOnce(async () => {
        throw new Error("503 Service Unavailable");
      })
      .mockResolvedValueOnce(respostaGeminiComTexto({ ok: true }));

    const promise = gerarRespostaEstruturada({ ...PARAMETROS_BASE, cadeiaModelos: ["modelo-a"] });
    await vi.runAllTimersAsync();
    const resultado = await promise;

    expect(resultado).toEqual({ ok: true });
    expect(generateContentMock).toHaveBeenCalledTimes(2);
    expect(generateContentMock.mock.calls[0]?.[0]).toMatchObject({ model: "modelo-a" });
    expect(generateContentMock.mock.calls[1]?.[0]).toMatchObject({ model: "modelo-a" });
  });

  it("erro de quota (429) faz no máximo 1 retentativa antes de cair para o próximo modelo da cadeia", async () => {
    const rejeitarComQuota = async () => {
      throw new Error("429 Resource has been exhausted (quota)");
    };
    generateContentMock
      .mockImplementationOnce(rejeitarComQuota)
      .mockImplementationOnce(rejeitarComQuota)
      .mockResolvedValueOnce(respostaGeminiComTexto({ ok: true }));

    const promise = gerarRespostaEstruturada({
      ...PARAMETROS_BASE,
      cadeiaModelos: ["modelo-a", "modelo-b"],
    });
    await vi.runAllTimersAsync();
    const resultado = await promise;

    expect(resultado).toEqual({ ok: true });
    expect(generateContentMock).toHaveBeenCalledTimes(3);
    // 2 tentativas no modelo-a (a retentativa de quota), depois 1ª tentativa no modelo-b.
    expect(generateContentMock.mock.calls[0]?.[0]).toMatchObject({ model: "modelo-a" });
    expect(generateContentMock.mock.calls[1]?.[0]).toMatchObject({ model: "modelo-a" });
    expect(generateContentMock.mock.calls[2]?.[0]).toMatchObject({ model: "modelo-b" });
  });

  it("erro de quota esgota a cadeia inteira e propaga o último erro quando nenhum modelo resta", async () => {
    const rejeitarComQuota = async () => {
      throw new Error("429 quota");
    };
    const rejeitarComQuotaFinal = async () => {
      throw new Error("429 quota final");
    };
    generateContentMock
      .mockImplementationOnce(rejeitarComQuota)
      .mockImplementationOnce(rejeitarComQuota)
      .mockImplementationOnce(rejeitarComQuotaFinal)
      .mockImplementationOnce(rejeitarComQuotaFinal);

    const promise = gerarRespostaEstruturada({
      ...PARAMETROS_BASE,
      cadeiaModelos: ["modelo-a", "modelo-b"],
    });
    // Anexa um handler síncrono já no momento da criação — evita que o
    // rejection settle durante `runAllTimersAsync()` seja reportado como
    // "unhandled" antes de `expect(...).rejects` ter a chance de anexar seu
    // próprio handler (falso positivo conhecido de fake timers + rejects).
    const promiseSilenciada = promise.catch(() => undefined);
    await vi.runAllTimersAsync();
    await promiseSilenciada;

    await expect(promise).rejects.toThrow("429 quota final");
    expect(generateContentMock).toHaveBeenCalledTimes(4);
  });

  it("erro não-transiente (ex: prompt/schema inválido) propaga direto, sem nenhuma retentativa", async () => {
    generateContentMock.mockImplementationOnce(async () => {
      throw new Error("Invalid argument: responseSchema malformado");
    });

    const promise = gerarRespostaEstruturada({
      ...PARAMETROS_BASE,
      cadeiaModelos: ["modelo-a", "modelo-b"],
    });
    const promiseSilenciada = promise.catch(() => undefined);
    await vi.runAllTimersAsync();
    await promiseSilenciada;

    await expect(promise).rejects.toThrow("Invalid argument: responseSchema malformado");
    expect(generateContentMock).toHaveBeenCalledTimes(1);
  });

  it("remove modelos duplicados da cadeia preservando a primeira ocorrência", async () => {
    generateContentMock.mockResolvedValueOnce(respostaGeminiComTexto({ ok: true }));

    const promise = gerarRespostaEstruturada({
      ...PARAMETROS_BASE,
      cadeiaModelos: ["modelo-a", "modelo-a", "modelo-b"],
    });
    await vi.runAllTimersAsync();
    await promise;

    expect(generateContentMock).toHaveBeenCalledTimes(1);
  });

  it("lança erro explícito quando a chave GEMINI_API_KEY não está configurada", async () => {
    delete process.env.GEMINI_API_KEY;

    await expect(
      gerarRespostaEstruturada({ ...PARAMETROS_BASE, cadeiaModelos: ["modelo-a"] }),
    ).rejects.toThrow("GEMINI_API_KEY não configurada");
    expect(generateContentMock).not.toHaveBeenCalled();
  });
});
