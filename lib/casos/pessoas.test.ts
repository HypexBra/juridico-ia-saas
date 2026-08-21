import { describe, expect, it } from "vitest";
import {
  tipoPessoaCasoValido,
  labelTipoPessoaCaso,
  normalizarDocumentoPessoa,
  normalizarTextoOpcional,
  montarPayloadPessoaCaso,
  montarPayloadParcialPessoaCaso,
  pessoaCasoInputSchema,
} from "@/lib/casos/pessoas";

describe("tipoPessoaCasoValido", () => {
  it("aceita os 4 valores definidos na migration 0023", () => {
    expect(tipoPessoaCasoValido("parte")).toBe(true);
    expect(tipoPessoaCasoValido("adverso")).toBe(true);
    expect(tipoPessoaCasoValido("testemunha")).toBe(true);
    expect(tipoPessoaCasoValido("terceiro")).toBe(true);
  });

  it("rejeita qualquer valor fora do enum, incluindo variações de caixa", () => {
    expect(tipoPessoaCasoValido("Parte")).toBe(false);
    expect(tipoPessoaCasoValido("réu")).toBe(false);
    expect(tipoPessoaCasoValido("")).toBe(false);
  });
});

describe("labelTipoPessoaCaso", () => {
  it("traduz cada tipo para um rótulo legível em português", () => {
    expect(labelTipoPessoaCaso("parte")).toBe("Parte");
    expect(labelTipoPessoaCaso("adverso")).toBe("Parte adversa");
    expect(labelTipoPessoaCaso("testemunha")).toBe("Testemunha");
    expect(labelTipoPessoaCaso("terceiro")).toBe("Terceiro interessado");
  });
});

describe("normalizarDocumentoPessoa", () => {
  it("formata um CPF válido com máscara, aceitando entrada só com dígitos", () => {
    expect(normalizarDocumentoPessoa("52998224725")).toBe("529.982.247-25");
  });

  it("formata um CPF válido com máscara, aceitando entrada já pontuada", () => {
    expect(normalizarDocumentoPessoa("529.982.247-25")).toBe("529.982.247-25");
  });

  it("com 11 dígitos mas CPF invalido (DV errado), devolve só os dígitos sem inventar máscara", () => {
    expect(normalizarDocumentoPessoa("11111111111")).toBe("11111111111");
    expect(normalizarDocumentoPessoa("12345678900")).toBe("12345678900");
  });

  it("formata um CNPJ válido com máscara", () => {
    expect(normalizarDocumentoPessoa("11222333000181")).toBe("11.222.333/0001-81");
  });

  it("com 14 dígitos mas CNPJ inválido, devolve só os dígitos", () => {
    expect(normalizarDocumentoPessoa("00000000000000")).toBe("00000000000000");
  });

  it("documento com formato diferente de CPF/CNPJ (RG, passaporte) é preservado, só com trim", () => {
    expect(normalizarDocumentoPessoa("  RG 12.345.678-9  ")).toBe("RG 12.345.678-9");
  });

  it("string vazia, só espaços, undefined ou null vira null", () => {
    expect(normalizarDocumentoPessoa("")).toBeNull();
    expect(normalizarDocumentoPessoa("   ")).toBeNull();
    expect(normalizarDocumentoPessoa(undefined)).toBeNull();
    expect(normalizarDocumentoPessoa(null)).toBeNull();
  });
});

describe("normalizarTextoOpcional", () => {
  it("remove espaços nas pontas de um valor presente", () => {
    expect(normalizarTextoOpcional("  advogado da parte contrária  ")).toBe("advogado da parte contrária");
  });

  it("string vazia, só espaços, undefined ou null vira null", () => {
    expect(normalizarTextoOpcional("")).toBeNull();
    expect(normalizarTextoOpcional("   ")).toBeNull();
    expect(normalizarTextoOpcional(undefined)).toBeNull();
    expect(normalizarTextoOpcional(null)).toBeNull();
  });
});

describe("pessoaCasoInputSchema", () => {
  it("aceita um payload mínimo válido (só tipo + nome)", () => {
    const resultado = pessoaCasoInputSchema.safeParse({ tipo: "adverso", nome: "João da Silva" });
    expect(resultado.success).toBe(true);
  });

  it("rejeita tipo fora do enum", () => {
    const resultado = pessoaCasoInputSchema.safeParse({ tipo: "reu", nome: "João da Silva" });
    expect(resultado.success).toBe(false);
  });

  it("rejeita nome vazio", () => {
    const resultado = pessoaCasoInputSchema.safeParse({ tipo: "parte", nome: "   " });
    expect(resultado.success).toBe(false);
  });
});

describe("montarPayloadPessoaCaso", () => {
  it("monta o payload completo aplicando normalização de documento/contato/papel", () => {
    const payload = montarPayloadPessoaCaso({
      tipo: "testemunha",
      nome: "  Maria Souza  ",
      documento: "52998224725",
      contato: "  (11) 99999-0000  ",
      papelProcessual: "  Testemunha de acusação  ",
    });

    expect(payload).toEqual({
      tipo: "testemunha",
      nome: "Maria Souza",
      documento: "529.982.247-25",
      contato: "(11) 99999-0000",
      papel_processual: "Testemunha de acusação",
    });
  });

  it("campos opcionais ausentes viram null, nunca undefined", () => {
    const payload = montarPayloadPessoaCaso({ tipo: "terceiro", nome: "Empresa X" });

    expect(payload.documento).toBeNull();
    expect(payload.contato).toBeNull();
    expect(payload.papel_processual).toBeNull();
  });
});

describe("montarPayloadParcialPessoaCaso", () => {
  it("só inclui as chaves de fato presentes no input", () => {
    const payload = montarPayloadParcialPessoaCaso({ nome: "Novo Nome" });

    expect(payload).toEqual({ nome: "Novo Nome" });
    expect("documento" in payload).toBe(false);
    expect("tipo" in payload).toBe(false);
  });

  it("input vazio produz payload vazio (chamador deve tratar como 'nada para atualizar')", () => {
    expect(montarPayloadParcialPessoaCaso({})).toEqual({});
  });

  it("permite limpar um campo opcional explicitamente enviando string vazia", () => {
    const payload = montarPayloadParcialPessoaCaso({ contato: "" });
    expect(payload).toEqual({ contato: null });
  });
});
