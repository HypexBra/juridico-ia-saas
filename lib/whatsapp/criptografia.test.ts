import { beforeEach, describe, expect, it, vi } from "vitest";

const ENV_KEY = "WHATSAPP_TOKEN_ENCRYPTION_KEY";

describe("criptografarToken/descriptografarToken (retrocompatibilidade)", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env[ENV_KEY] = "chave-whatsapp-de-teste-alta-entropia";
  });

  it("faz round-trip preservando o token original", async () => {
    const { criptografarToken, descriptografarToken } = await import("./criptografia");
    const token = "EAAG_token_de_acesso_meta_cloud_api_1234567890";
    const ciphertext = criptografarToken(token);
    expect(descriptografarToken(ciphertext)).toBe(token);
  });

  it("mantém o formato iv:authTag:dados em hex", async () => {
    const { criptografarToken } = await import("./criptografia");
    const ciphertext = criptografarToken("qualquer-token");
    expect(ciphertext.split(":")).toHaveLength(3);
  });

  it("lança erro claro quando a env var não está configurada", async () => {
    delete process.env[ENV_KEY];
    const { criptografarToken } = await import("./criptografia");
    expect(() => criptografarToken("token")).toThrow("WHATSAPP_TOKEN_ENCRYPTION_KEY não configurada");
  });
});
