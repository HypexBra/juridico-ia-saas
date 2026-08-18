import "server-only";

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * Criptografia simétrica (AES-256-GCM) do `token_acesso` da Meta Cloud API
 * antes de gravar em `canais_whatsapp_escritorio` — é o "ARMAZENAR
 * CRIPTOGRAFADO pela camada de aplicação" previsto no comentário da coluna
 * na migration 0008. Sem Supabase Vault/pgsodium configurado neste projeto
 * ainda, então a chave vive numa env var só do servidor (nunca
 * `NEXT_PUBLIC_*`, nunca lida em client component).
 *
 * Formato do ciphertext gravado no banco: `iv:authTag:dados`, tudo em hex —
 * autocontido, não precisa de coluna extra pro IV.
 */

const ALGORITMO = "aes-256-gcm";
const TAMANHO_IV = 12; // recomendado para GCM

function derivarChave(): Buffer {
  const segredo = process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY;
  if (!segredo) {
    throw new Error(
      "WHATSAPP_TOKEN_ENCRYPTION_KEY não configurada — necessária para criptografar/decriptografar o token do canal WhatsApp.",
    );
  }
  // scrypt com salt fixo derivado do próprio propósito: o segredo de entrada
  // já é de alta entropia (gerado 1x e guardado só nas env vars do
  // servidor), então o salt fixo aqui só normaliza para 32 bytes exigidos
  // pelo AES-256 — não está protegendo contra brute-force de senha fraca.
  return scryptSync(segredo, "whatsapp-canal-escritorio", 32);
}

export function criptografarToken(tokenPlano: string): string {
  const chave = derivarChave();
  const iv = randomBytes(TAMANHO_IV);
  const cipher = createCipheriv(ALGORITMO, chave, iv);
  const criptografado = Buffer.concat([cipher.update(tokenPlano, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${criptografado.toString("hex")}`;
}

export function descriptografarToken(ciphertext: string): string {
  const partes = ciphertext.split(":");
  if (partes.length !== 3) {
    throw new Error("Formato de token criptografado inválido.");
  }
  const [ivHex, authTagHex, dadosHex] = partes;
  const chave = derivarChave();
  const decipher = createDecipheriv(ALGORITMO, chave, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const decriptografado = Buffer.concat([decipher.update(Buffer.from(dadosHex, "hex")), decipher.final()]);
  return decriptografado.toString("utf8");
}
