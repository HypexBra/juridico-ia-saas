import "server-only";

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * Primitiva genérica de criptografia simétrica (AES-256-GCM) usada por TODOS
 * os módulos do projeto que precisam cifrar um segredo recuperável em texto
 * puro em runtime (não é hash — hash é irreversível por design e não serve
 * aqui). Extraída de `lib/whatsapp/criptografia.ts` (primeiro caso de uso)
 * para ser reaproveitada por `lib/ia/chaves/criptografia.ts` sem duplicar a
 * lógica de cifra/decifra — cada caller passa sua PRÓPRIA `masterKey` (env
 * var dedicada) e seu PRÓPRIO `salt` (string fixa que só identifica o
 * propósito, não precisa ser secreta) para que um vazamento de uma
 * `masterKey` nunca comprometa segredos cifrados com outra (blast radius
 * segregado por domínio).
 *
 * Formato do ciphertext: `iv:authTag:dados`, tudo em hex — autocontido, não
 * precisa de coluna extra pro IV. Retrocompatível byte-a-byte com o formato
 * já gravado hoje pelo módulo do WhatsApp.
 */

const ALGORITMO = "aes-256-gcm";
const TAMANHO_IV = 12; // recomendado para GCM

function derivarChave(masterKey: string, salt: string): Buffer {
  // scrypt com salt fixo derivado do próprio propósito: a masterKey de
  // entrada já é de alta entropia (gerada 1x e guardada só nas env vars do
  // servidor), então o salt fixo aqui só normaliza para 32 bytes exigidos
  // pelo AES-256 — não está protegendo contra brute-force de senha fraca.
  return scryptSync(masterKey, salt, 32);
}

export function cifrar(texto: string, masterKey: string, salt: string): string {
  const chave = derivarChave(masterKey, salt);
  const iv = randomBytes(TAMANHO_IV);
  const cipher = createCipheriv(ALGORITMO, chave, iv);
  const criptografado = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${criptografado.toString("hex")}`;
}

export function decifrar(ciphertext: string, masterKey: string, salt: string): string {
  const partes = ciphertext.split(":");
  if (partes.length !== 3) {
    throw new Error("Formato de ciphertext inválido (esperado iv:authTag:dados em hex).");
  }
  const [ivHex, authTagHex, dadosHex] = partes as [string, string, string];
  const chave = derivarChave(masterKey, salt);
  const decipher = createDecipheriv(ALGORITMO, chave, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const decriptografado = Buffer.concat([decipher.update(Buffer.from(dadosHex, "hex")), decipher.final()]);
  return decriptografado.toString("utf8");
}
