import "server-only";

import { cifrar, decifrar } from "@/lib/seguranca/criptografia-simetrica";

/**
 * Criptografia simétrica (AES-256-GCM) do `token_acesso` da Meta Cloud API
 * antes de gravar em `canais_whatsapp_escritorio` — é o "ARMAZENAR
 * CRIPTOGRAFADO pela camada de aplicação" previsto no comentário da coluna
 * na migration 0008. Sem Supabase Vault/pgsodium configurado neste projeto
 * ainda, então a chave vive numa env var só do servidor (nunca
 * `NEXT_PUBLIC_*`, nunca lida em client component).
 *
 * Wrapper fino sobre `lib/seguranca/criptografia-simetrica.ts` (primitiva
 * genérica compartilhada com `lib/ia/chaves/criptografia.ts`) — mantém
 * exatamente a mesma env var (`WHATSAPP_TOKEN_ENCRYPTION_KEY`) e o mesmo
 * salt (`"whatsapp-canal-escritorio"`) de antes da extração, então nenhum
 * token já cifrado no banco hoje precisa ser re-cifrado (retrocompatível
 * byte-a-byte: mesmo formato `iv:authTag:dados` em hex).
 */

const SALT = "whatsapp-canal-escritorio";

function obterMasterKey(): string {
  const segredo = process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY;
  if (!segredo) {
    throw new Error(
      "WHATSAPP_TOKEN_ENCRYPTION_KEY não configurada — necessária para criptografar/decriptografar o token do canal WhatsApp.",
    );
  }
  return segredo;
}

export function criptografarToken(tokenPlano: string): string {
  return cifrar(tokenPlano, obterMasterKey(), SALT);
}

export function descriptografarToken(ciphertext: string): string {
  return decifrar(ciphertext, obterMasterKey(), SALT);
}
