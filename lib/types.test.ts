import { describe, expect, it } from "vitest";
import { LIMITE_MENSAGENS_FREE, LIMITE_MENSAGENS_PRO, limiteMensagensIaPara } from "./types";

describe("limiteMensagensIaPara", () => {
  it("retorna o limite free para escritório no plano free", () => {
    expect(limiteMensagensIaPara("free")).toBe(LIMITE_MENSAGENS_FREE);
  });

  it("retorna o limite pro (300) para escritório no plano pro, não o limite free", () => {
    expect(limiteMensagensIaPara("pro")).toBe(LIMITE_MENSAGENS_PRO);
    expect(limiteMensagensIaPara("pro")).not.toBe(LIMITE_MENSAGENS_FREE);
  });
});
