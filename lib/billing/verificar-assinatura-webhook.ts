import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifica a assinatura HMAC-SHA256 do header `Stripe-Signature`
 * (formato documentado pelo Stripe: `t=<timestamp>,v1=<hash_hex>`) contra o
 * corpo BRUTO da requisição — igual ao padrão já usado no webhook do
 * Autentique (`lib/assinatura/autentique.ts`): nunca reparsear/reserializar
 * o JSON antes de calcular o HMAC, o hash é sobre os bytes exatos enviados.
 *
 * Sem `STRIPE_WEBHOOK_SECRET` configurada, retorna sempre `false` — a rota
 * do webhook fica estruturalmente pronta mas nunca aceita nenhum payload
 * até a env var existir (ver app/api/webhooks/stripe/route.ts).
 */
export function validarAssinaturaWebhookStripe(corpoBruto: string, headerAssinatura: string | null): boolean {
  const segredo = process.env.STRIPE_WEBHOOK_SECRET;
  if (!segredo || !headerAssinatura) return false;

  const partes = new Map<string, string>();
  for (const par of headerAssinatura.split(",")) {
    const [chave, valor] = par.split("=");
    if (chave && valor) partes.set(chave, valor);
  }

  const timestamp = partes.get("t");
  const assinaturaRecebidaHex = partes.get("v1");
  if (!timestamp || !assinaturaRecebidaHex) return false;

  const payloadAssinado = `${timestamp}.${corpoBruto}`;
  const assinaturaEsperadaHex = createHmac("sha256", segredo).update(payloadAssinado).digest("hex");

  const bufferRecebido = Buffer.from(assinaturaRecebidaHex, "hex");
  const bufferEsperado = Buffer.from(assinaturaEsperadaHex, "hex");
  if (bufferRecebido.length !== bufferEsperado.length) return false;

  return timingSafeEqual(bufferRecebido, bufferEsperado);
}
