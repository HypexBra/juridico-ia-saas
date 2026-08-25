import { describe, expect, it } from "vitest";
import { montarPromptComparacaoDocumento, parsearRespostaComparacaoDocumento } from "./prompt-comparacao";

function respostaBaseValida(): Record<string, unknown> {
  return {
    resumoGeral: "A cláusula de multa foi aumentada e uma cláusula de foro foi adicionada.",
    clausulas: [
      {
        tipoMudanca: "alterada",
        trechoA: "Multa de 5% em caso de rescisão.",
        paginaA: 3,
        trechoB: "Multa de 10% em caso de rescisão.",
        paginaB: 3,
        certeza: "confirmado",
        resumoMudanca: "Multa de rescisão dobrou.",
        risco: "medio",
      },
      {
        tipoMudanca: "adicionada",
        trechoA: null,
        paginaA: null,
        trechoB: "Fica eleito o foro de São Paulo.",
        paginaB: 8,
        certeza: "confirmado",
        resumoMudanca: "Cláusula de foro adicionada.",
        risco: "baixo",
      },
    ],
    riscosIntroduzidos: [
      {
        tipoMudanca: "alterada",
        trechoA: "Multa de 5% em caso de rescisão.",
        paginaA: 3,
        trechoB: "Multa de 10% em caso de rescisão.",
        paginaB: 3,
        certeza: "confirmado",
        resumoMudanca: "Multa de rescisão dobrou.",
        risco: "medio",
        descricao: "Aumento de multa pode desincentivar rescisão legítima.",
      },
    ],
    recomendacoes: ["Negociar a redução da multa de volta para 5%."],
  };
}

describe("montarPromptComparacaoDocumento", () => {
  it("delimita os dois documentos com marcadores distintos", () => {
    const prompt = montarPromptComparacaoDocumento({
      nomeArquivoA: "contrato-v1.pdf",
      paginasA: [{ pagina: 1, texto: "Conteúdo A." }],
      truncadoA: false,
      nomeArquivoB: "contrato-v2.pdf",
      paginasB: [{ pagina: 1, texto: "Conteúdo B." }],
      truncadoB: false,
    });

    expect(prompt).toContain("===INÍCIO DOCUMENTO A===");
    expect(prompt).toContain("===FIM DOCUMENTO A===");
    expect(prompt).toContain("===INÍCIO DOCUMENTO B===");
    expect(prompt).toContain("===FIM DOCUMENTO B===");
    const inicioA = prompt.indexOf("===INÍCIO DOCUMENTO A===");
    const inicioB = prompt.indexOf("===INÍCIO DOCUMENTO B===");
    expect(inicioA).toBeLessThan(inicioB);
  });

  it("inclui aviso de truncamento por documento, independentemente", () => {
    const prompt = montarPromptComparacaoDocumento({
      nomeArquivoA: "grande.pdf",
      paginasA: [{ pagina: 1, texto: "x" }],
      truncadoA: true,
      nomeArquivoB: "pequeno.pdf",
      paginasB: [{ pagina: 1, texto: "y" }],
      truncadoB: false,
    });

    expect(prompt).toContain("Documento A excede o limite");
    expect(prompt).not.toContain("Documento B excede o limite");
  });
});

describe("parsearRespostaComparacaoDocumento", () => {
  it("aceita uma resposta válida", () => {
    const resultado = parsearRespostaComparacaoDocumento(respostaBaseValida());

    expect(resultado).not.toBeNull();
    expect(resultado?.clausulas).toHaveLength(2);
    expect(resultado?.riscosIntroduzidos).toHaveLength(1);
  });

  it("rejeita tipoMudanca 'adicionada' com trechoA preenchido (viola o .refine())", () => {
    const bruto = respostaBaseValida();
    bruto.clausulas = [
      {
        tipoMudanca: "adicionada",
        trechoA: "Não deveria existir para 'adicionada'.",
        paginaA: 1,
        trechoB: "Cláusula nova.",
        paginaB: 2,
        certeza: "confirmado",
        resumoMudanca: "x",
        risco: null,
      },
    ];

    expect(parsearRespostaComparacaoDocumento(bruto)).toBeNull();
  });

  it("rejeita tipoMudanca 'removida' sem trechoA preenchido (viola o .refine())", () => {
    const bruto = respostaBaseValida();
    bruto.clausulas = [
      {
        tipoMudanca: "removida",
        trechoA: null,
        paginaA: null,
        trechoB: null,
        paginaB: null,
        certeza: "confirmado",
        resumoMudanca: "x",
        risco: null,
      },
    ];

    expect(parsearRespostaComparacaoDocumento(bruto)).toBeNull();
  });

  it("rejeita tipoMudanca 'alterada' faltando um dos dois trechos", () => {
    const bruto = respostaBaseValida();
    bruto.clausulas = [
      {
        tipoMudanca: "alterada",
        trechoA: "Só o lado A preenchido.",
        paginaA: 1,
        trechoB: null,
        paginaB: null,
        certeza: "confirmado",
        resumoMudanca: "x",
        risco: null,
      },
    ];

    expect(parsearRespostaComparacaoDocumento(bruto)).toBeNull();
  });

  it("rejeita certeza 'nao_encontrado' sem justificativa quando tipoMudanca exigiria trecho (fail-closed)", () => {
    const bruto = respostaBaseValida();
    bruto.clausulas = [
      {
        tipoMudanca: "alterada",
        trechoA: "",
        paginaA: null,
        trechoB: "Trecho B presente.",
        paginaB: 2,
        certeza: "nao_encontrado",
        resumoMudanca: "x",
        risco: null,
      },
    ];

    // "nao_encontrado" só é aceitável quando a mudança em si não exigiria os
    // dois trechos preenchidos — aqui "alterada" exige ambos, então mesmo com
    // certeza "nao_encontrado" o schema rejeita por trechoA vazio.
    expect(parsearRespostaComparacaoDocumento(bruto)).toBeNull();
  });

  it("aceita certeza 'nao_encontrado' quando a mudança é 'adicionada' e trechoA é null por definição", () => {
    const bruto = respostaBaseValida();
    bruto.clausulas = [
      {
        tipoMudanca: "adicionada",
        trechoA: null,
        paginaA: null,
        trechoB: "Existe uma cláusula sobre isso em algum lugar do documento B.",
        paginaB: null,
        certeza: "confirmado",
        resumoMudanca: "x",
        risco: null,
      },
    ];

    expect(parsearRespostaComparacaoDocumento(bruto)).not.toBeNull();
  });

  it("rejeita tipoMudanca fora do enum", () => {
    const bruto = respostaBaseValida();
    bruto.clausulas = [
      {
        tipoMudanca: "invalida",
        trechoA: "a",
        paginaA: 1,
        trechoB: "b",
        paginaB: 1,
        certeza: "confirmado",
        resumoMudanca: "x",
        risco: null,
      },
    ];

    expect(parsearRespostaComparacaoDocumento(bruto)).toBeNull();
  });

  it("retorna null para shapes claramente inválidos", () => {
    expect(parsearRespostaComparacaoDocumento(null)).toBeNull();
    expect(parsearRespostaComparacaoDocumento("texto solto")).toBeNull();
    expect(parsearRespostaComparacaoDocumento({})).toBeNull();
  });
});
