import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { autorizarChamadaCron } from "./autorizar";

const SECRET = "s3cr3t-de-teste-com-entropia-suficiente";

function requisicaoCom(authorization?: string): Request {
  return new Request("https://exemplo.test/api/cron/x", {
    headers: authorization ? { authorization } : {},
  });
}

describe("autorizarChamadaCron", () => {
  let secretOriginal: string | undefined;

  beforeEach(() => {
    secretOriginal = process.env.CRON_SECRET;
    process.env.CRON_SECRET = SECRET;
  });

  afterEach(() => {
    if (secretOriginal === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = secretOriginal;
  });

  it("autoriza com o Bearer correto", () => {
    expect(autorizarChamadaCron(requisicaoCom(`Bearer ${SECRET}`))).toEqual({ ok: true });
  });

  it("recusa com 401 quando o secret está errado", () => {
    const resultado = autorizarChamadaCron(requisicaoCom("Bearer errado"));
    expect(resultado).toEqual({ ok: false, status: 401, erro: "Não autorizado." });
  });

  it("recusa com 401 sem header nenhum", () => {
    expect(autorizarChamadaCron(requisicaoCom())).toMatchObject({ ok: false, status: 401 });
  });

  it("recusa com 401 quando o esquema não é Bearer", () => {
    expect(autorizarChamadaCron(requisicaoCom(`Basic ${SECRET}`))).toMatchObject({ ok: false, status: 401 });
  });

  it("responde 500 (não 401) quando CRON_SECRET não está configurado no servidor", () => {
    delete process.env.CRON_SECRET;
    const resultado = autorizarChamadaCron(requisicaoCom("Bearer qualquer-coisa"));
    expect(resultado).toEqual({
      ok: false,
      status: 500,
      erro: "CRON_SECRET não configurado no servidor.",
    });
  });

  it("NÃO aceita 'Bearer undefined' quando CRON_SECRET está ausente", () => {
    // Regressão da falha estrutural que motivou este módulo: comparar contra
    // `Bearer ${process.env.CRON_SECRET}` com a env var ausente produz a
    // string literal "Bearer undefined", que qualquer um pode mandar.
    delete process.env.CRON_SECRET;
    expect(autorizarChamadaCron(requisicaoCom("Bearer undefined")).ok).toBe(false);
  });

  it("recusa um secret que é prefixo do correto (sem confundir tamanho com igualdade)", () => {
    expect(autorizarChamadaCron(requisicaoCom(`Bearer ${SECRET.slice(0, -1)}`)).ok).toBe(false);
  });
});
