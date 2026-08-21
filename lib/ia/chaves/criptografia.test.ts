import { beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";

const ENV_KEY = "IA_PROVIDER_KEY_ENCRYPTION_KEY";

describe("cifrarChaveIa/decifrarChaveIa", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env[ENV_KEY] = "chave-ia-provider-de-teste-alta-entropia";
  });

  it("faz round-trip preservando a chave original", async () => {
    const { cifrarChaveIa, decifrarChaveIa } = await import("./criptografia");
    const chave = "AIzaSyD_exemplo_de_chave_gemini_1234567890";
    const ciphertext = cifrarChaveIa(chave);
    expect(decifrarChaveIa(ciphertext)).toBe(chave);
  });

  it("usa salt distinto do módulo de whatsapp — mesma masterKey não decifra o ciphertext do outro domínio", async () => {
    const { cifrarChaveIa } = await import("./criptografia");
    const { decifrar } = await import("@/lib/seguranca/criptografia-simetrica");

    const ciphertextIa = cifrarChaveIa("chave-plana");
    // Mesmo com a MESMA masterKey, o salt do WhatsApp é diferente do salt
    // "ia-provider-chave" — a derivação de chave AES diverge e a
    // autenticação GCM falha.
    expect(() => decifrar(ciphertextIa, process.env[ENV_KEY] as string, "whatsapp-canal-escritorio")).toThrow();
  });
});

describe("mascararChaveParaPreview", () => {
  it("mascara mantendo só os primeiros e últimos caracteres", async () => {
    const { mascararChaveParaPreview } = await import("./criptografia");
    expect(mascararChaveParaPreview("AIzaSyD1234567890abcdef")).toBe("AIzaSy...cdef");
  });

  it("nunca expõe o meio de chaves curtas", async () => {
    const { mascararChaveParaPreview } = await import("./criptografia");
    const preview = mascararChaveParaPreview("abc1234567");
    expect(preview).not.toContain("1234567");
  });
});
