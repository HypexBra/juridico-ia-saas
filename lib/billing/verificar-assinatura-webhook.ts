import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifica a assinatura HMAC-SHA256 do header `Stripe-Signature`
 * (formato documentado pelo Stripe: `t=<timestamp>,v1=<hash_hex>`) contra o
 * corpo BRUTO da requisição · igual ao padrão já usado no webhook do
 * Autentique (`lib/assinatura/autentique.ts`): nunca reparsear/reserializar
 * o JSON antes de calcular o HMAC, o hash é sobre os bytes exatos enviados.
 *
 * Sem `STRIPE_WEBHOOK_SECRET` configurada, retorna sempre `false` · a rota
 * do webhook fica estruturalmente pronta mas nunca aceita nenhum payload
 * até a env var existir (ver app/api/webhooks/stripe/route.ts).
 *
 * Duas proteções além do HMAC em si, ambas parte do esquema documentado pelo
 * Stripe e ausentes na primeira versão desta função:
 *
 * 1. JANELA DE TOLERÂNCIA no `t=` (timestamp). Sem ela, o HMAC continua
 *    válido para sempre: quem interceptar UMA entrega legítima (log de proxy,
 *    header vazado, request salvo) pode reenviá-la indefinidamente, e a rota
 *    aceitaria. O `t` faz parte do payload assinado, então não pode ser
 *    forjado sem o segredo · checá-lo contra o relógio fecha a janela de
 *    replay em `TOLERANCIA_SEGUNDOS`.
 * 2. MÚLTIPLAS assinaturas `v1`. Durante rotação de endpoint secret o Stripe
 *    envia o header com mais de um `v1=` (um por segredo ativo). Guardar só
 *    o último num Map descartaria a assinatura válida quando ela vem
 *    primeiro · rejeitando entregas legítimas durante a rotação.
 */

/**
 * Mesma tolerância padrão da biblioteca oficial do Stripe (5 minutos): larga
 * o suficiente para absorver clock skew real entre o Stripe e a Vercel, curta
 * o suficiente para que um payload capturado não seja reutilizável.
 */
const TOLERANCIA_SEGUNDOS = 300;

export function validarAssinaturaWebhookStripe(corpoBruto: string, headerAssinatura: string | null): boolean {
  const segredo = process.env.STRIPE_WEBHOOK_SECRET;
  if (!segredo || !headerAssinatura) return false;

  let timestamp: string | null = null;
  const assinaturasRecebidasHex: string[] = [];
  for (const par of headerAssinatura.split(",")) {
    // `split("=", 2)` não serve: descartaria o resto se o valor tivesse "=".
    const separador = par.indexOf("=");
    if (separador <= 0) continue;
    const chave = par.slice(0, separador).trim();
    const valor = par.slice(separador + 1).trim();
    if (!valor) continue;
    if (chave === "t") timestamp = valor;
    else if (chave === "v1") assinaturasRecebidasHex.push(valor);
  }

  if (!timestamp || assinaturasRecebidasHex.length === 0) return false;

  const timestampSegundos = Number(timestamp);
  if (!Number.isFinite(timestampSegundos)) return false;
  const idadeSegundos = Math.abs(Date.now() / 1000 - timestampSegundos);
  if (idadeSegundos > TOLERANCIA_SEGUNDOS) return false;

  const payloadAssinado = `${timestamp}.${corpoBruto}`;
  const bufferEsperado = Buffer.from(createHmac("sha256", segredo).update(payloadAssinado).digest("hex"), "hex");

  // Percorre TODAS as assinaturas sem short-circuit por `some`: o custo é
  // irrelevante (no máximo duas durante rotação) e evita que o tempo de
  // resposta revele qual das assinaturas casou.
  let confere = false;
  for (const assinaturaHex of assinaturasRecebidasHex) {
    const bufferRecebido = Buffer.from(assinaturaHex, "hex");
    if (bufferRecebido.length !== bufferEsperado.length) continue;
    if (timingSafeEqual(bufferRecebido, bufferEsperado)) confere = true;
  }

  return confere;
}
