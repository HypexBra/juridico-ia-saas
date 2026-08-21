import "server-only";

import { cifrar, decifrar } from "@/lib/seguranca/criptografia-simetrica";

/**
 * Cifra/decifra as chaves de API dos provedores de LLM (Gemini/Groq) da
 * própria plataforma, gravadas em `ia_provider_chaves.chave_cifrada`. Usa
 * uma env var PRÓPRIA (`IA_PROVIDER_KEY_ENCRYPTION_KEY`) — nunca reaproveita
 * `WHATSAPP_TOKEN_ENCRYPTION_KEY` — de propósito: segrega o blast radius, um
 * vazamento de uma das duas master keys não compromete os segredos cifrados
 * com a outra.
 */

const SALT = "ia-provider-chave";

function obterMasterKey(): string {
  const segredo = process.env.IA_PROVIDER_KEY_ENCRYPTION_KEY;
  if (!segredo) {
    throw new Error(
      "IA_PROVIDER_KEY_ENCRYPTION_KEY não configurada — necessária para cifrar/decifrar chaves de provedores de IA (ver /admin/ia-chaves).",
    );
  }
  return segredo;
}

export function cifrarChaveIa(chavePlana: string): string {
  return cifrar(chavePlana, obterMasterKey(), SALT);
}

export function decifrarChaveIa(ciphertext: string): string {
  return decifrar(ciphertext, obterMasterKey(), SALT);
}

/**
 * Prévia mascarada para exibição na UI de gestão (ex: "AIzaSyD1…ab12"):
 * mantém só os primeiros e os últimos caracteres, nunca é usada para
 * reconstituir a chave — gravada uma única vez em `chave_preview` no momento
 * da criação (ver `lib/ia/chaves/gestao-actions.ts#criarChaveIa`).
 */
export function mascararChaveParaPreview(chavePlana: string): string {
  const texto = chavePlana.trim();
  if (texto.length <= 10) return `${texto.slice(0, 2)}…${texto.slice(-2)}`;
  return `${texto.slice(0, 6)}...${texto.slice(-4)}`;
}
