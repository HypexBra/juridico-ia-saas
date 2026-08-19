import { describe, expect, it } from "vitest";
import { montarPromptRedline, parsearRespostaRedline } from "./prompt";

const CONTRATO_BASE = "Cláusula 1. O CONTRATADO poderá rescindir a qualquer tempo sem aviso prévio.";

describe("montarPromptRedline", () => {
  it("inclui o título e o texto do contrato", () => {
    const prompt = montarPromptRedline({ titulo: "Contrato de prestação de serviços", textoContrato: CONTRATO_BASE });

    expect(prompt).toContain("Contrato de prestação de serviços");
    expect(prompt).toContain(CONTRATO_BASE);
  });

  it("usa placeholder explícito quando o título não é informado", () => {
    const prompt = montarPromptRedline({ titulo: null, textoContrato: CONTRATO_BASE });

    expect(prompt).toContain("não informado");
  });

  it("ignora título em branco (trata como não informado)", () => {
    const prompt = montarPromptRedline({ titulo: "   ", textoContrato: CONTRATO_BASE });

    expect(prompt).toContain("Título/identificação do documento: não informado");
  });

  it("delimita claramente o bloco do contrato, isolando-o das instruções de sistema", () => {
    const prompt = montarPromptRedline({ titulo: null, textoContrato: CONTRATO_BASE });

    expect(prompt).toContain("===INÍCIO DO CONTRATO===");
    expect(prompt).toContain("===FIM DO CONTRATO===");
    const inicio = prompt.indexOf("===INÍCIO DO CONTRATO===");
    const fim = prompt.indexOf("===FIM DO CONTRATO===");
    expect(inicio).toBeLessThan(fim);
  });
});

describe("parsearRespostaRedline", () => {
  it("aceita uma resposta válida e calcula quantidadeRiscoAlto a partir das cláusulas", () => {
    const bruto = {
      clausulas: [
        { numero: 2, trechoOriginal: "Cláusula 2...", veredito: "ok", problema: null, sugestao: null },
        {
          numero: 1,
          trechoOriginal: "Cláusula 1...",
          veredito: "risco_alto",
          problema: "Rescisão unilateral sem aviso prévio.",
          sugestao: "Incluir prazo mínimo de 30 dias de aviso prévio.",
        },
      ],
      resumoGeral: "Contrato com um ponto de risco alto relacionado à rescisão.",
    };

    const resultado = parsearRespostaRedline(bruto);

    expect(resultado).not.toBeNull();
    expect(resultado?.quantidadeRiscoAlto).toBe(1);
    // Reordena por número, independente da ordem devolvida pela IA.
    expect(resultado?.clausulas.map((c) => c.numero)).toEqual([1, 2]);
  });

  it("normaliza strings vazias de problema/sugestao para null", () => {
    const bruto = {
      clausulas: [{ numero: 1, trechoOriginal: "Cláusula 1...", veredito: "ok", problema: "", sugestao: "" }],
      resumoGeral: "Sem riscos relevantes.",
    };

    const resultado = parsearRespostaRedline(bruto);

    expect(resultado?.clausulas[0].problema).toBeNull();
    expect(resultado?.clausulas[0].sugestao).toBeNull();
  });

  it("ignora quantidadeRiscoAlto vinda da IA e sempre recalcula pelo array de cláusulas", () => {
    const bruto = {
      // Mesmo se a IA tentasse mandar esse campo, o schema não o declara e o
      // valor é ignorado — só o array de cláusulas é fonte de verdade.
      quantidadeRiscoAlto: 999,
      clausulas: [{ numero: 1, trechoOriginal: "Cláusula 1...", veredito: "risco_alto", problema: "x", sugestao: null }],
      resumoGeral: "Um risco alto.",
    };

    const resultado = parsearRespostaRedline(bruto);

    expect(resultado?.quantidadeRiscoAlto).toBe(1);
  });

  it("retorna null quando a resposta não bate com o schema esperado", () => {
    expect(parsearRespostaRedline({ clausulas: [], resumoGeral: "vazio" })).toBeNull();
    expect(parsearRespostaRedline({ resumoGeral: "sem clausulas" })).toBeNull();
    expect(parsearRespostaRedline(null)).toBeNull();
    expect(parsearRespostaRedline("texto solto")).toBeNull();
  });

  it("retorna null quando o veredito não é um valor válido do enum", () => {
    const bruto = {
      clausulas: [{ numero: 1, trechoOriginal: "x", veredito: "muito_ruim", problema: null, sugestao: null }],
      resumoGeral: "resumo",
    };

    expect(parsearRespostaRedline(bruto)).toBeNull();
  });
});
