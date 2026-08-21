import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuotaExcedidaError } from "./erros";

const { sendMessageMock, createMock, selecionarChaveMock, registrarFalhaQuotaMock } = vi.hoisted(() => ({
  sendMessageMock: vi.fn(),
  createMock: vi.fn(),
  selecionarChaveMock: vi.fn(),
  registrarFalhaQuotaMock: vi.fn(),
}));

vi.mock("@google/genai", async (importOriginal) => {
  const original = await importOriginal<typeof import("@google/genai")>();
  return {
    ...original,
    GoogleGenAI: class {
      chats = { create: createMock };
    },
  };
});
vi.mock("@/lib/ia/chaves/pool", () => ({
  selecionarChave: selecionarChaveMock,
  registrarFalhaQuota: registrarFalhaQuotaMock,
}));

const { gerarRespostaGemini } = await import("./gemini");

const HISTORICO = [{ role: "user" as const, conteudo: "Oi, tudo bem?" }];

function respostaOk() {
  return { text: "resposta ok", usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 }, functionCalls: [] };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  selecionarChaveMock.mockResolvedValue({ id: "chave-1", chavePlana: "chave-de-teste" });
  createMock.mockReturnValue({ sendMessage: sendMessageMock });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("gerarRespostaGemini", () => {
  it("erro transiente NÃO-quota (503 sustentado) esgota retentativas no modelo, avança para o próximo modelo da cadeia e por fim lança QuotaExcedidaError para acionar o fallback cross-provider — fix do bug 'IA indisponível sem trocar'", async () => {
    const rejeitarCom503 = async () => {
      throw new Error('{"error":{"code":503,"message":"model overloaded","status":"UNAVAILABLE"}}');
    };
    sendMessageMock
      .mockImplementationOnce(rejeitarCom503)
      .mockImplementationOnce(rejeitarCom503)
      .mockImplementationOnce(rejeitarCom503) // esgota MAX_TENTATIVAS no 1º modelo
      .mockImplementationOnce(rejeitarCom503)
      .mockImplementationOnce(rejeitarCom503)
      .mockImplementationOnce(rejeitarCom503); // esgota MAX_TENTATIVAS no modelo de fallback

    const promise = gerarRespostaGemini(HISTORICO);
    const promiseSilenciada = promise.catch(() => undefined);
    await vi.runAllTimersAsync();
    await promiseSilenciada;

    await expect(promise).rejects.toBeInstanceOf(QuotaExcedidaError);
    expect(sendMessageMock).toHaveBeenCalledTimes(6);
  });

  it("erro transiente 503 se recupera no próximo modelo da cadeia sem propagar erro", async () => {
    const rejeitarCom503 = async () => {
      throw new Error("503 Service Unavailable");
    };
    sendMessageMock
      .mockImplementationOnce(rejeitarCom503)
      .mockImplementationOnce(rejeitarCom503)
      .mockImplementationOnce(rejeitarCom503)
      .mockResolvedValueOnce(respostaOk());

    const promise = gerarRespostaGemini(HISTORICO);
    await vi.runAllTimersAsync();
    const resultado = await promise;

    expect(resultado.texto).toBe("resposta ok");
    expect(sendMessageMock).toHaveBeenCalledTimes(4);
  });

  it("erro não-transiente (prompt inválido) propaga direto, sem trocar de modelo", async () => {
    sendMessageMock.mockImplementationOnce(async () => {
      throw new Error("Invalid argument: prompt malformado");
    });

    const promise = gerarRespostaGemini(HISTORICO);
    const promiseSilenciada = promise.catch(() => undefined);
    await vi.runAllTimersAsync();
    await promiseSilenciada;

    await expect(promise).rejects.toThrow("Invalid argument: prompt malformado");
    expect(sendMessageMock).toHaveBeenCalledTimes(1);
  });
});
