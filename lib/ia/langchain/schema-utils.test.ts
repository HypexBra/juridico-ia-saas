import { describe, expect, it } from "vitest";
import { paraJsonSchemaOpenAi } from "./schema-utils";

describe("paraJsonSchemaOpenAi", () => {
  it("converte type MAIÚSCULO (Gemini) para minúsculo (JSON Schema padrão)", () => {
    const resultado = paraJsonSchemaOpenAi({ type: "OBJECT" }) as Record<string, unknown>;
    expect(resultado.type).toBe("object");
  });

  it("mantém a estrutura de properties/required/enum recursivamente", () => {
    const schemaGemini = {
      type: "OBJECT",
      properties: {
        nome: { type: "STRING" },
        status: { type: "STRING", format: "enum", enum: ["ativo", "inativo"] },
      },
      required: ["nome"],
    };

    const resultado = paraJsonSchemaOpenAi(schemaGemini) as {
      type: string;
      properties: { nome: { type: string }; status: { type: string; enum: string[]; format?: string } };
      required: string[];
    };

    expect(resultado.type).toBe("object");
    expect(resultado.properties.nome.type).toBe("string");
    expect(resultado.properties.status.type).toBe("string");
    expect(resultado.properties.status.enum).toEqual(["ativo", "inativo"]);
    expect(resultado.properties.status.format).toBeUndefined();
    expect(resultado.required).toEqual(["nome"]);
  });

  it("converte arrays recursivamente", () => {
    const resultado = paraJsonSchemaOpenAi([{ type: "STRING" }, { type: "NUMBER" }]) as Array<{ type: string }>;
    expect(resultado[0]?.type).toBe("string");
    expect(resultado[1]?.type).toBe("number");
  });

  it("preserva valores primitivos e null sem alteração", () => {
    expect(paraJsonSchemaOpenAi(null)).toBeNull();
    expect(paraJsonSchemaOpenAi("texto")).toBe("texto");
    expect(paraJsonSchemaOpenAi(42)).toBe(42);
  });
});
