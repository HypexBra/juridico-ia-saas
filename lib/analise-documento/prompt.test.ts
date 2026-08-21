import { describe, expect, it } from "vitest";
import { montarPromptAnaliseDocumento, parsearRespostaAnaliseDocumento } from "./prompt";

const CITACAO_OK = { trechoOriginal: "Cláusula 5ª: multa de 10% em caso de rescisão.", pagina: 2, certeza: "confirmado" as const };

function respostaBaseValida(): Record<string, unknown> {
  return {
    tipoDocumento: "contrato",
    resumoExecutivo: "Contrato de prestação de serviços com cláusula de rescisão e multa.",
    pontosChave: [{ ...CITACAO_OK, descricao: "Multa de 10% em caso de rescisão." }],
    clausulas: [
      { ...CITACAO_OK, numero: 5, veredito: "atencao", problema: "Multa acima da média de mercado.", sugestao: "Negociar redução para 5%." },
    ],
    entidades: {
      datas: [{ ...CITACAO_OK, data: "2026-01-10", descricao: "Data de assinatura." }],
      valores: [{ ...CITACAO_OK, valor: "R$ 10.000,00", descricao: "Valor total do contrato." }],
      partes: [{ ...CITACAO_OK, nome: "Empresa X Ltda.", papel: "contratante" }],
    },
    inconsistencias: [{ ...CITACAO_OK, descricao: "Datas divergentes entre preâmbulo e assinatura." }],
    riscos: [{ ...CITACAO_OK, descricao: "Multa desproporcional.", nivel: "medio" as const }],
    informacoesAusentes: ["Não há testemunhas identificadas no documento."],
  };
}

describe("montarPromptAnaliseDocumento", () => {
  it("delimita o texto do documento com marcadores explícitos e página", () => {
    const prompt = montarPromptAnaliseDocumento({
      tipo: "texto",
      nomeArquivo: "contrato.pdf",
      paginas: [{ pagina: 1, texto: "Conteúdo da página 1." }],
      truncado: false,
    });

    expect(prompt).toContain("===INÍCIO DO DOCUMENTO===");
    expect(prompt).toContain("===FIM DO DOCUMENTO===");
    expect(prompt).toContain("--- Página 1 ---");
  });

  it("para imagem, não inclui bloco de documento e orienta pagina null", () => {
    const prompt = montarPromptAnaliseDocumento({ tipo: "imagem", nomeArquivo: "foto.jpg" });

    expect(prompt).not.toContain("===INÍCIO DO DOCUMENTO===");
    expect(prompt).toContain("IMAGEM");
    expect(prompt).toContain("pagina");
  });
});

describe("parsearRespostaAnaliseDocumento", () => {
  it("aceita uma resposta válida", () => {
    const resultado = parsearRespostaAnaliseDocumento(respostaBaseValida());

    expect(resultado).not.toBeNull();
    expect(resultado?.tipoDocumento).toBe("contrato");
    expect(resultado?.clausulas).toHaveLength(1);
  });

  it("aceita certeza 'nao_encontrado' com trechoOriginal vazio", () => {
    const bruto = respostaBaseValida();
    bruto.inconsistencias = [
      { trechoOriginal: "", pagina: null, certeza: "nao_encontrado", descricao: "Não há inconsistências claras." },
    ];

    expect(parsearRespostaAnaliseDocumento(bruto)).not.toBeNull();
  });

  it("rejeita certeza 'confirmado' com trechoOriginal vazio (guardrail anti-alucinação)", () => {
    const bruto = respostaBaseValida();
    bruto.riscos = [{ trechoOriginal: "", pagina: null, certeza: "confirmado", descricao: "Risco inventado.", nivel: "alto" }];

    expect(parsearRespostaAnaliseDocumento(bruto)).toBeNull();
  });

  it("rejeita cláusula com veredito diferente de 'ok' e sem 'problema' preenchido", () => {
    const bruto = respostaBaseValida();
    bruto.clausulas = [{ ...CITACAO_OK, numero: 1, veredito: "risco_alto", problema: null, sugestao: null }];

    expect(parsearRespostaAnaliseDocumento(bruto)).toBeNull();
  });

  it("rejeita certeza fora do enum", () => {
    const bruto = respostaBaseValida();
    bruto.riscos = [{ ...CITACAO_OK, certeza: "muito_certo", descricao: "x", nivel: "alto" }];

    expect(parsearRespostaAnaliseDocumento(bruto)).toBeNull();
  });

  it("rejeita quando falta um campo obrigatório do topo", () => {
    const bruto = respostaBaseValida() as Record<string, unknown>;
    delete bruto.entidades;

    expect(parsearRespostaAnaliseDocumento(bruto)).toBeNull();
  });

  it("retorna null para shapes claramente inválidos", () => {
    expect(parsearRespostaAnaliseDocumento(null)).toBeNull();
    expect(parsearRespostaAnaliseDocumento("texto solto")).toBeNull();
    expect(parsearRespostaAnaliseDocumento({})).toBeNull();
  });
});
