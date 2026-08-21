import { describe, expect, it } from "vitest";
import { cifrar, decifrar } from "./criptografia-simetrica";

const MASTER_KEY = "chave-de-teste-de-alta-entropia-1234567890";
const SALT = "salt-de-teste";

describe("cifrar/decifrar (AES-256-GCM)", () => {
  it("faz round-trip: decifrar(cifrar(x)) === x", () => {
    const texto = "segredo-super-secreto-123";
    const ciphertext = cifrar(texto, MASTER_KEY, SALT);
    expect(decifrar(ciphertext, MASTER_KEY, SALT)).toBe(texto);
  });

  it("gera ciphertext no formato iv:authTag:dados em hex", () => {
    const ciphertext = cifrar("qualquer coisa", MASTER_KEY, SALT);
    const partes = ciphertext.split(":");
    expect(partes).toHaveLength(3);
    for (const parte of partes) {
      expect(parte).toMatch(/^[0-9a-f]+$/);
    }
  });

  it("gera ciphertexts diferentes para o mesmo texto (IV aleatório)", () => {
    const a = cifrar("mesmo texto", MASTER_KEY, SALT);
    const b = cifrar("mesmo texto", MASTER_KEY, SALT);
    expect(a).not.toBe(b);
  });

  it("nunca decifra com salt diferente do usado para cifrar", () => {
    const ciphertext = cifrar("dado sensível", MASTER_KEY, SALT);
    expect(() => decifrar(ciphertext, MASTER_KEY, "salt-errado")).toThrow();
  });

  it("nunca decifra com masterKey diferente da usada para cifrar", () => {
    const ciphertext = cifrar("dado sensível", MASTER_KEY, SALT);
    expect(() => decifrar(ciphertext, "outra-master-key", SALT)).toThrow();
  });

  it("rejeita ciphertext com formato inválido", () => {
    expect(() => decifrar("formato-invalido-sem-dois-pontos", MASTER_KEY, SALT)).toThrow(
      "Formato de ciphertext inválido",
    );
  });
});
