import { describe, expect, it } from "vitest";
import {
  MotorTemplateCondicionalError,
  modeloUsaLogicaCondicional,
  resolverMailMergeCondicional,
} from "./motor";

describe("resolverMailMergeCondicional — variáveis simples", () => {
  it("substitui variáveis presentes", () => {
    const resultado = resolverMailMergeCondicional("Prezado {{nome_cliente}}, processo {{numero_processo}}.", {
      nome_cliente: "João Silva",
      numero_processo: "0001234-56.2024.8.26.0100",
    });

    expect(resultado.textoFinal).toBe("Prezado João Silva, processo 0001234-56.2024.8.26.0100.");
    expect(resultado.variaveisUsadas).toEqual({
      nome_cliente: "João Silva",
      numero_processo: "0001234-56.2024.8.26.0100",
    });
    expect(resultado.variaveisNaoResolvidas).toEqual([]);
  });

  it("trata variável ausente como 'não informado' e reporta em variaveisNaoResolvidas", () => {
    const resultado = resolverMailMergeCondicional("Cliente: {{nome_cliente}}. Área: {{area_direito}}.", {
      nome_cliente: "Maria",
    });

    expect(resultado.textoFinal).toBe("Cliente: Maria. Área: não informado.");
    expect(resultado.variaveisNaoResolvidas).toEqual(["area_direito"]);
  });

  it("trata variável nula e string vazia/só-espaços como não resolvida", () => {
    const resultado = resolverMailMergeCondicional("{{a}}-{{b}}-{{c}}", { a: null, b: "", c: "   " });
    expect(resultado.textoFinal).toBe("não informado-não informado-não informado");
    expect(resultado.variaveisNaoResolvidas).toEqual(["a", "b", "c"]);
  });

  it("não altera texto sem nenhuma tag reconhecida (compatível com o mail-merge simples)", () => {
    const resultado = resolverMailMergeCondicional("Texto puro sem variáveis.", {});
    expect(resultado.textoFinal).toBe("Texto puro sem variáveis.");
  });
});

describe("resolverMailMergeCondicional — {{#se}}/{{#senao}}/{{/se}}", () => {
  it("inclui o bloco quando a condição truthy é verdadeira", () => {
    const template = "{{#se urgente}}ATENÇÃO: caso urgente.{{/se}}";
    expect(resolverMailMergeCondicional(template, { urgente: true }).textoFinal).toBe("ATENÇÃO: caso urgente.");
  });

  it("omite o bloco quando a condição truthy é falsa/ausente", () => {
    const template = "antes-{{#se urgente}}ATENÇÃO{{/se}}-depois";
    expect(resolverMailMergeCondicional(template, { urgente: false }).textoFinal).toBe("antes--depois");
    expect(resolverMailMergeCondicional(template, {}).textoFinal).toBe("antes--depois");
  });

  it("avalia igualdade de string (==) corretamente", () => {
    const template = '{{#se area_direito == "Trabalhista"}}Bloco CLT{{/se}}';
    expect(resolverMailMergeCondicional(template, { area_direito: "Trabalhista" }).textoFinal).toBe("Bloco CLT");
    expect(resolverMailMergeCondicional(template, { area_direito: "Cível" }).textoFinal).toBe("");
  });

  it("avalia diferença de string (!=) corretamente", () => {
    const template = '{{#se area_direito != "Trabalhista"}}Bloco genérico{{/se}}';
    expect(resolverMailMergeCondicional(template, { area_direito: "Cível" }).textoFinal).toBe("Bloco genérico");
    expect(resolverMailMergeCondicional(template, { area_direito: "Trabalhista" }).textoFinal).toBe("");
  });

  it("resolve o ramo {{#senao}} quando a condição é falsa", () => {
    const template = '{{#se area_direito == "Trabalhista"}}CLT{{#senao}}Outra área{{/se}}';
    expect(resolverMailMergeCondicional(template, { area_direito: "Trabalhista" }).textoFinal).toBe("CLT");
    expect(resolverMailMergeCondicional(template, { area_direito: "Cível" }).textoFinal).toBe("Outra área");
  });

  it("avalia comparação numérica (>, <, >=, <=)", () => {
    expect(
      resolverMailMergeCondicional("{{#se valor > 1000}}alto{{/se}}", { valor: 1500 }).textoFinal,
    ).toBe("alto");
    expect(
      resolverMailMergeCondicional("{{#se valor > 1000}}alto{{/se}}", { valor: 500 }).textoFinal,
    ).toBe("");
    expect(
      resolverMailMergeCondicional("{{#se valor <= 1000}}baixo{{/se}}", { valor: 1000 }).textoFinal,
    ).toBe("baixo");
  });

  it("aceita valor numérico em formato brasileiro (R$ 1.234,56) na comparação", () => {
    const resultado = resolverMailMergeCondicional("{{#se valor > 1000}}alto{{/se}}", { valor: "R$ 1.234,56" });
    expect(resultado.textoFinal).toBe("alto");
  });

  it("condição falsa quando o campo não existe (nunca quebra) e reporta em variaveisNaoResolvidas", () => {
    const resultado = resolverMailMergeCondicional("{{#se campo_inexistente}}X{{/se}}", {});
    expect(resultado.textoFinal).toBe("");
    expect(resultado.variaveisNaoResolvidas).toContain("campo_inexistente");
  });

  it("condição numérica falsa quando o valor não é numérico (nunca lança erro)", () => {
    const resultado = resolverMailMergeCondicional("{{#se valor > 100}}X{{/se}}", { valor: "abc" });
    expect(resultado.textoFinal).toBe("");
  });

  it("lança MotorTemplateCondicionalError para operador de texto usado com número", () => {
    expect(() => resolverMailMergeCondicional('{{#se valor > "10"}}X{{/se}}', { valor: 20 })).toThrow(
      MotorTemplateCondicionalError,
    );
  });

  it("lança MotorTemplateCondicionalError quando {{#se}} não tem {{/se}} correspondente", () => {
    expect(() => resolverMailMergeCondicional("{{#se urgente}}X", { urgente: true })).toThrow(
      MotorTemplateCondicionalError,
    );
  });

  it("lança MotorTemplateCondicionalError para {{/se}} sem abertura", () => {
    expect(() => resolverMailMergeCondicional("X{{/se}}", {})).toThrow(MotorTemplateCondicionalError);
  });
});

describe("resolverMailMergeCondicional — {{#cada}}/{{/cada}}", () => {
  it("não renderiza nada quando a coleção tem 0 itens", () => {
    const resultado = resolverMailMergeCondicional("antes-{{#cada parcelas}}X{{/cada}}-depois", { parcelas: [] });
    expect(resultado.textoFinal).toBe("antes--depois");
  });

  it("renderiza o bloco uma vez por item (1 item)", () => {
    const template = "{{#cada parcelas}}Parcela {{indice}}: {{valor}}\n{{/cada}}";
    const resultado = resolverMailMergeCondicional(template, { parcelas: [{ valor: "R$ 100,00" }] });
    expect(resultado.textoFinal).toBe("Parcela 1: R$ 100,00\n");
  });

  it("renderiza o bloco N vezes com índice 1-based incrementando", () => {
    const template = "{{#cada parcelas}}[{{indice}}:{{valor}}]{{/cada}}";
    const resultado = resolverMailMergeCondicional(template, {
      parcelas: [{ valor: "10" }, { valor: "20" }, { valor: "30" }],
    });
    expect(resultado.textoFinal).toBe("[1:10][2:20][3:30]");
  });

  it("dentro do loop, campo do item tem prioridade sobre o escopo externo, mas cai pro externo se ausente", () => {
    const template = "{{#cada parcelas}}{{nome_cliente}} deve {{valor}}. {{/cada}}";
    const resultado = resolverMailMergeCondicional(template, {
      nome_cliente: "João",
      parcelas: [{ valor: "100" }, { valor: "200", nome_cliente: "Maria (avalista)" }],
    });
    expect(resultado.textoFinal).toBe("João deve 100. Maria (avalista) deve 200. ");
  });

  it("coleção ausente (typo) não quebra, e é reportada em variaveisNaoResolvidas", () => {
    const resultado = resolverMailMergeCondicional("{{#cada parcela_atrasada}}X{{/cada}}", {});
    expect(resultado.textoFinal).toBe("");
    expect(resultado.variaveisNaoResolvidas).toContain("parcela_atrasada");
  });

  it("lança MotorTemplateCondicionalError quando {{#cada}} não tem {{/cada}} correspondente", () => {
    expect(() => resolverMailMergeCondicional("{{#cada parcelas}}X", { parcelas: [] })).toThrow(
      MotorTemplateCondicionalError,
    );
  });
});

describe("resolverMailMergeCondicional — aninhamento", () => {
  it("suporta {{#se}} dentro de {{#cada}}, filtrando itens por condição do próprio item", () => {
    const template = "{{#cada parcelas}}{{#se atrasada}}Parcela {{indice}} atrasada! {{/se}}{{/cada}}";
    const resultado = resolverMailMergeCondicional(template, {
      parcelas: [{ atrasada: false }, { atrasada: true }, { atrasada: true }],
    });
    expect(resultado.textoFinal).toBe("Parcela 2 atrasada! Parcela 3 atrasada! ");
  });

  it("suporta {{#cada}} dentro de {{#se}}", () => {
    const template = '{{#se area_direito == "Trabalhista"}}Parcelas: {{#cada parcelas}}{{valor}};{{/cada}}{{/se}}';
    const resultado = resolverMailMergeCondicional(template, {
      area_direito: "Trabalhista",
      parcelas: [{ valor: "10" }, { valor: "20" }],
    });
    expect(resultado.textoFinal).toBe("Parcelas: 10;20;");
  });

  it("cenário completo: petição com condicional por área + loop de parcelas em atraso", () => {
    const template = [
      "Ao Juízo,",
      "",
      "{{#se area_direito == \"Trabalhista\"}}",
      "Trata-se de reclamação trabalhista movida por {{nome_cliente}}.",
      "{{#senao}}",
      "Trata-se de ação cível movida por {{nome_cliente}}.",
      "{{/se}}",
      "",
      "{{#cada parcelas}}",
      "{{#se atrasada}}A parcela {{numero_parcela}}, no valor de {{valor}}, está em atraso.",
      "{{/se}}",
      "{{/cada}}",
    ].join("\n");

    const resultado = resolverMailMergeCondicional(template, {
      nome_cliente: "Empresa XYZ",
      area_direito: "Trabalhista",
      parcelas: [
        { numero_parcela: 1, valor: "R$ 500,00", atrasada: false },
        { numero_parcela: 2, valor: "R$ 500,00", atrasada: true },
      ],
    });

    expect(resultado.textoFinal).toContain("Trata-se de reclamação trabalhista movida por Empresa XYZ.");
    expect(resultado.textoFinal).not.toContain("ação cível");
    expect(resultado.textoFinal).toContain("A parcela 2, no valor de R$ 500,00, está em atraso.");
    expect(resultado.textoFinal).not.toContain("A parcela 1");
  });
});

describe("modeloUsaLogicaCondicional", () => {
  it("detecta {{#se}}", () => {
    expect(modeloUsaLogicaCondicional('Texto {{#se x == "1"}}bloco{{/se}}')).toBe(true);
  });

  it("detecta {{#cada}}", () => {
    expect(modeloUsaLogicaCondicional("Texto {{#cada parcelas}}bloco{{/cada}}")).toBe(true);
  });

  it("retorna false para modelo com apenas variáveis simples", () => {
    expect(modeloUsaLogicaCondicional("Prezado {{nome_cliente}}, processo {{numero_processo}}.")).toBe(false);
  });
});
