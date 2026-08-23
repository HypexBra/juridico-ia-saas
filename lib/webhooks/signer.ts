import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Assinatura de webhooks de saída (Fase 22) — módulo PURO e server-safe:
 * sem I/O, sem estado, sem dependência de Next/Supabase. Roda igual no
 * runtime do Next e nos testes de Vitest.
 *
 * Esquema de assinatura (inspirado em Stripe/GitHub, versão própria):
 *   - HMAC-SHA256 sobre a string `${timestamp}.${payload}`;
 *   - header `X-JuridicoIA-Signature: t=<timestamp>,v1=<hmac-hex>`;
 *   - o timestamp no header permite ao receptor rejeitar replays.
 */

/** Comprimento do segredo: 32 bytes aleatórios do CSPRNG do Node, hex = 64 chars. */
export function gerarSecretWebhook(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Calcula o HMAC-SHA256 (hex) de `${timestamp}.${payload}` usando `secret`
 * como chave. Determinístico: mesmos inputs → mesma saída (coberto por
 * vetor fixo em signer.test.ts).
 *
 * O payload DEVE ser exatamente a string enviada no corpo do POST — qualquer
 * byte diferente (espaço, ordem de chave) invalida a assinatura.
 */
export function assinarPayload(
  secret: string,
  payload: string,
  timestamp: number,
): { assinatura: string; timestamp: number } {
  const mac = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return { assinatura: mac, timestamp };
}

/** Headers canônicos enviados em toda entrega de webhook. */
export type CabecalhosWebhook = {
  "Content-Type": string;
  "X-JuridicoIA-Event": string;
  "X-JuridicoIA-Signature": string;
};

/**
 * Monta os headers da entrega:
 *   - `X-JuridicoIA-Signature: t=<ts>,v1=<hmac>` — timestamp Unix em segundos
 *     junto do MAC, para o receptor validar frescor E autenticidade;
 *   - `X-JuridicoIA-Event` — nome do evento (ex: "prazo.criado");
 *   - `Content-Type: application/json`.
 *
 * @param timestamp Unix EM SEGUNDOS (não ms) — mesmo valor que o receptor
 *        usa para recomputar o HMAC e checar a janela anti-replay.
 */
export function montarCabecalhosWebhook(
  secret: string,
  evento: string,
  payload: string,
  timestamp: number = Math.floor(Date.now() / 1000),
): CabecalhosWebhook {
  const { assinatura } = assinarPayload(secret, payload, timestamp);
  return {
    "Content-Type": "application/json",
    "X-JuridicoIA-Event": evento,
    "X-JuridicoIA-Signature": `t=${timestamp},v1=${assinatura}`,
  };
}

/**
 * COMO O RECEPTOR VALIDA (documentação do contrato — implemente no seu
 * endpoint consumidor):
 *
 * ```ts
 * import { timingSafeEqual, createHmac } from "node:crypto";
 *
 * function validarRecebimento(secret: string, corpoBruto: string, header: string) {
 *   // 1) Parse do header: t=1690000000,v1=abcdef...
 *   const [, t = "", v1 = ""] = /t=(\d+),v1=([0-9a-f]{64})/.exec(header) ?? [];
 *   if (!t || !v1) throw new Error("Assinatura ausente/malformada.");
 *
 *   // 2) Anti-replay: rejeite timestamps fora de uma janela (ex.: 5 min).
 *   if (Math.abs(Math.floor(Date.now() / 1000) - Number(t)) > 300) {
 *     throw new Error("Timestamp fora da janela permitida.");
 *   }
 *
 *   // 3) Recompute o HMAC sobre EXATAMENTE o corpo bruto recebido.
 *   const esperado = createHmac("sha256", secret).update(`${t}.${corpoBruto}`).digest();
 *
 *   // 4) Compare EM TEMPO CONSTANTE (timingSafeEqual) — nunca `===` sobre
 *   //    strings/hex: comparação curto-circuitável vaza o MAC byte a byte
 *   //    via tempo de resposta.
 *   const recebido = Buffer.from(v1, "hex");
 *   if (recebido.length !== esperado.length || !timingSafeEqual(recebido, esperado)) {
 *     throw new Error("Assinatura inválida.");
 *   }
 * }
 * ```
 *
 * Referência pronta usada nos nossos próprios testes de round-trip:
 */
export function verificarAssinaturaWebhook(
  secret: string,
  payload: string,
  cabecalho: string,
  maxAgeSegundos?: number,
): boolean {
  const match = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(cabecalho);
  if (!match) return false;

  const timestamp = match[1];
  const macHex = match[2];
  if (!timestamp || !macHex) return false;

  if (maxAgeSegundos !== undefined && Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > maxAgeSegundos) {
    return false;
  }

  const { assinatura } = assinarPayload(secret, payload, Number(timestamp));
  // Comparação em tempo constante sobre os BYTES derivados (evita o
  // short-circuit de `===` sobre strings — ver JSDoc acima, passo 4).
  const recebido = Buffer.from(macHex, "hex");
  const esperado = Buffer.from(assinatura, "hex");
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}
