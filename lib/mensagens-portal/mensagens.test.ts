import { describe, expect, it } from "vitest";
import {
  CONTEUDO_MENSAGEM_MAX,
  contarNaoLidasDoEscritorio,
  enviarMensagemPortalSchema,
  inserirSemDuplicar,
  ordenarMensagens,
} from "./mensagens";
import type { MensagemPortalCliente } from "@/lib/types";

function mensagem(overrides: Partial<MensagemPortalCliente>): MensagemPortalCliente {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    escritorio_id: "esc-1",
    ficha_caso_id: "ficha-1",
    cliente_portal_id: "cliente-1",
    remetente: "cliente",
    conteudo: "olá",
    lida: false,
    criado_em: "2026-01-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("enviarMensagemPortalSchema", () => {
  it("aceita payload válido e remove espaços das bordas", () => {
    const resultado = enviarMensagemPortalSchema.safeParse({
      fichaId: "11111111-1111-4111-8111-111111111111",
      conteudo: "  Olá, boa tarde  ",
    });
    expect(resultado.success).toBe(true);
    if (resultado.success) expect(resultado.data.conteudo).toBe("Olá, boa tarde");
  });

  it("rejeita mensagem vazia (só espaços)", () => {
    const resultado = enviarMensagemPortalSchema.safeParse({
      fichaId: "11111111-1111-4111-8111-111111111111",
      conteudo: "   ",
    });
    expect(resultado.success).toBe(false);
  });

  it("rejeita mensagem acima do limite de caracteres", () => {
    const resultado = enviarMensagemPortalSchema.safeParse({
      fichaId: "11111111-1111-4111-8111-111111111111",
      conteudo: "a".repeat(CONTEUDO_MENSAGEM_MAX + 1),
    });
    expect(resultado.success).toBe(false);
  });

  it("rejeita fichaId que não é uuid", () => {
    const resultado = enviarMensagemPortalSchema.safeParse({ fichaId: "abc", conteudo: "oi" });
    expect(resultado.success).toBe(false);
  });
});

describe("ordenarMensagens", () => {
  it("ordena por criado_em crescente", () => {
    const a = mensagem({ id: "a", criado_em: "2026-01-01T10:05:00.000Z" });
    const b = mensagem({ id: "b", criado_em: "2026-01-01T10:00:00.000Z" });
    const c = mensagem({ id: "c", criado_em: "2026-01-01T10:10:00.000Z" });
    expect(ordenarMensagens([a, b, c]).map((m) => m.id)).toEqual(["b", "a", "c"]);
  });

  it("desempata por id quando o timestamp é idêntico", () => {
    const a = mensagem({ id: "b-mensagem", criado_em: "2026-01-01T10:00:00.000Z" });
    const b = mensagem({ id: "a-mensagem", criado_em: "2026-01-01T10:00:00.000Z" });
    expect(ordenarMensagens([a, b]).map((m) => m.id)).toEqual(["a-mensagem", "b-mensagem"]);
  });

  it("não muta o array original", () => {
    const original = [mensagem({ id: "a", criado_em: "2026-01-01T10:05:00.000Z" }), mensagem({ id: "b", criado_em: "2026-01-01T10:00:00.000Z" })];
    const copia = [...original];
    ordenarMensagens(original);
    expect(original).toEqual(copia);
  });
});

describe("inserirSemDuplicar", () => {
  it("adiciona nova mensagem mantendo ordenação", () => {
    const existente = [mensagem({ id: "a", criado_em: "2026-01-01T10:00:00.000Z" })];
    const nova = mensagem({ id: "b", criado_em: "2026-01-01T10:05:00.000Z" });
    const resultado = inserirSemDuplicar(existente, nova);
    expect(resultado.map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("ignora mensagem já existente (mesmo id)", () => {
    const existente = [mensagem({ id: "a", criado_em: "2026-01-01T10:00:00.000Z" })];
    const duplicada = mensagem({ id: "a", criado_em: "2026-01-01T10:00:00.000Z" });
    const resultado = inserirSemDuplicar(existente, duplicada);
    expect(resultado).toHaveLength(1);
  });
});

describe("contarNaoLidasDoEscritorio", () => {
  it("conta só mensagens do escritório não lidas", () => {
    const mensagens = [
      mensagem({ id: "a", remetente: "escritorio", lida: false }),
      mensagem({ id: "b", remetente: "escritorio", lida: true }),
      mensagem({ id: "c", remetente: "cliente", lida: false }),
    ];
    expect(contarNaoLidasDoEscritorio(mensagens)).toBe(1);
  });

  it("retorna 0 quando não há mensagens", () => {
    expect(contarNaoLidasDoEscritorio([])).toBe(0);
  });
});
