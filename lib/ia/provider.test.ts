import { describe, expect, it, vi, beforeEach } from "vitest";
import { QuotaExcedidaError, TodosProvidersIndisponiveisError } from "./erros";

const gerarRespostaGeminiMock = vi.fn();
const gerarRespostaGroqMock = vi.fn();

vi.mock("./gemini", () => ({
  gerarRespostaGemini: (...args: unknown[]) => gerarRespostaGeminiMock(...args),
}));
vi.mock("./groq", () => ({
  gerarRespostaGroq: (...args: unknown[]) => gerarRespostaGroqMock(...args),
}));

const HISTORICO = [{ role: "user" as const, conteudo: "Olá" }];
const RESPOSTA_OK = { texto: "oi", tokensIn: 1, tokensOut: 1, functionCalls: [] };

describe("gerarResposta (lib/ia/provider.ts)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("chama só o Gemini quando ele responde com sucesso (fluxo automático)", async () => {
    gerarRespostaGeminiMock.mockResolvedValueOnce(RESPOSTA_OK);
    const { gerarResposta } = await import("./provider");

    const resultado = await gerarResposta(HISTORICO);

    expect(resultado).toEqual(RESPOSTA_OK);
    expect(gerarRespostaGroqMock).not.toHaveBeenCalled();
  });

  it("cai para o Groq quando o Gemini esgota quota (QuotaExcedidaError)", async () => {
    gerarRespostaGeminiMock.mockRejectedValueOnce(new QuotaExcedidaError(new Error("429")));
    gerarRespostaGroqMock.mockResolvedValueOnce(RESPOSTA_OK);
    const { gerarResposta } = await import("./provider");

    const resultado = await gerarResposta(HISTORICO);

    expect(resultado).toEqual(RESPOSTA_OK);
    expect(gerarRespostaGroqMock).toHaveBeenCalledTimes(1);
  });

  it("propaga erro não-quota do Gemini direto, sem acionar o fallback", async () => {
    const erroConfig = new Error("prompt inválido");
    gerarRespostaGeminiMock.mockRejectedValueOnce(erroConfig);
    const { gerarResposta } = await import("./provider");

    await expect(gerarResposta(HISTORICO)).rejects.toBe(erroConfig);
    expect(gerarRespostaGroqMock).not.toHaveBeenCalled();
  });

  it("fix do bug de fallback preso: quando Gemini E Groq falham, lança TodosProvidersIndisponiveisError preservando as duas causas (nunca mascara com só o erro do Groq)", async () => {
    const erroGemini = new QuotaExcedidaError(new Error("gemini 429"));
    const erroGroq = new Error("GROQ_API_KEY não configurada");
    gerarRespostaGeminiMock.mockRejectedValueOnce(erroGemini);
    gerarRespostaGroqMock.mockRejectedValueOnce(erroGroq);
    const { gerarResposta } = await import("./provider");

    let capturado: unknown;
    try {
      await gerarResposta(HISTORICO);
    } catch (erro) {
      capturado = erro;
    }

    expect(capturado).toBeInstanceOf(TodosProvidersIndisponiveisError);
    const erroFinal = capturado as TodosProvidersIndisponiveisError;
    expect(erroFinal.causaGemini).toBe(erroGemini);
    expect(erroFinal.causaGroq).toBe(erroGroq);
  });

  it("providerOverride='groq': chama só o Groq, propaga erro direto sem tentar o Gemini", async () => {
    const erroGroq = new Error("groq indisponível");
    gerarRespostaGroqMock.mockRejectedValueOnce(erroGroq);
    const { gerarResposta } = await import("./provider");

    await expect(gerarResposta(HISTORICO, { providerOverride: { provider: "groq" } })).rejects.toBe(erroGroq);
    expect(gerarRespostaGeminiMock).not.toHaveBeenCalled();
  });

  it("providerOverride='gemini': chama só o Gemini, nunca aciona fallback para Groq mesmo em quota esgotada", async () => {
    const erroQuota = new QuotaExcedidaError(new Error("429"));
    gerarRespostaGeminiMock.mockRejectedValueOnce(erroQuota);
    const { gerarResposta } = await import("./provider");

    await expect(gerarResposta(HISTORICO, { providerOverride: { provider: "gemini" } })).rejects.toBe(erroQuota);
    expect(gerarRespostaGroqMock).not.toHaveBeenCalled();
  });
});
