import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { validarAssinaturaWebhookStripe } from "./verificar-assinatura-webhook";

const SEGREDO = "whsec_teste_1234567890";
const CORPO = JSON.stringify({ type: "checkout.session.completed", data: { object: {} } });

function assinar(corpo: string, timestampSegundos: number, segredo = SEGREDO): string {
  return createHmac("sha256", segredo).update(`${timestampSegundos}.${corpo}`).digest("hex");
}

function agoraSegundos(): number {
  return Math.floor(Date.now() / 1000);
}

describe("validarAssinaturaWebhookStripe", () => {
  let segredoOriginal: string | undefined;

  beforeEach(() => {
    segredoOriginal = process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_WEBHOOK_SECRET = SEGREDO;
  });

  afterEach(() => {
    if (segredoOriginal === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = segredoOriginal;
  });

  it("aceita uma assinatura válida e recente", () => {
    const t = agoraSegundos();
    expect(validarAssinaturaWebhookStripe(CORPO, `t=${t},v1=${assinar(CORPO, t)}`)).toBe(true);
  });

  it("rejeita replay de uma entrega antiga, mesmo com HMAC válido", () => {
    // Sem janela de tolerância, este caso passava: o HMAC continua correto
    // para sempre, então quem capturasse uma entrega legítima poderia
    // reenviá-la indefinidamente.
    const t = agoraSegundos() - 3600;
    expect(validarAssinaturaWebhookStripe(CORPO, `t=${t},v1=${assinar(CORPO, t)}`)).toBe(false);
  });

  it("rejeita timestamp muito no futuro", () => {
    const t = agoraSegundos() + 3600;
    expect(validarAssinaturaWebhookStripe(CORPO, `t=${t},v1=${assinar(CORPO, t)}`)).toBe(false);
  });

  it("aceita dentro da tolerância de 5 minutos", () => {
    const t = agoraSegundos() - 280;
    expect(validarAssinaturaWebhookStripe(CORPO, `t=${t},v1=${assinar(CORPO, t)}`)).toBe(true);
  });

  it("aceita quando há mais de um v1 e o válido não é o último (rotação de segredo)", () => {
    const t = agoraSegundos();
    const valido = assinar(CORPO, t);
    const deOutroSegredo = assinar(CORPO, t, "whsec_segredo_antigo");
    expect(validarAssinaturaWebhookStripe(CORPO, `t=${t},v1=${valido},v1=${deOutroSegredo}`)).toBe(true);
  });

  it("rejeita quando o corpo foi alterado depois de assinado", () => {
    const t = agoraSegundos();
    const assinatura = assinar(CORPO, t);
    expect(validarAssinaturaWebhookStripe(`${CORPO} `, `t=${t},v1=${assinatura}`)).toBe(false);
  });

  it("rejeita header sem t ou sem v1", () => {
    const t = agoraSegundos();
    expect(validarAssinaturaWebhookStripe(CORPO, `v1=${assinar(CORPO, t)}`)).toBe(false);
    expect(validarAssinaturaWebhookStripe(CORPO, `t=${t}`)).toBe(false);
  });

  it("rejeita timestamp não numérico", () => {
    expect(validarAssinaturaWebhookStripe(CORPO, `t=ontem,v1=${assinar(CORPO, agoraSegundos())}`)).toBe(false);
  });

  it("é fail-closed sem STRIPE_WEBHOOK_SECRET configurado", () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const t = agoraSegundos();
    expect(validarAssinaturaWebhookStripe(CORPO, `t=${t},v1=${assinar(CORPO, t)}`)).toBe(false);
  });

  it("rejeita header nulo", () => {
    expect(validarAssinaturaWebhookStripe(CORPO, null)).toBe(false);
  });
});
