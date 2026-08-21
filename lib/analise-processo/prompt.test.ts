import { describe, expect, it } from "vitest";
import { montarPromptAnaliseProcesso, parsearRespostaAnaliseProcesso } from "./prompt";

const CITACAO_OK = { trechoOriginal: "Fls. 3, intimação publicada em 10/01/2026.", pagina: 3, certeza: "confirmado" as const };

function respostaBaseValida(): Record<string, unknown> {
  return {
    resumoExecutivo: "Ação de cobrança em fase inicial, réu ainda não citado.",
    linhaDoTempo: [{ ...CITACAO_OK, data: "2026-01-10", descricao: "Intimação publicada." }],
    pessoasPartes: [{ ...CITACAO_OK, nome: "João da Silva", papel: "réu", documento: null }],
    documentosEncontrados: [{ ...CITACAO_OK, tipo: "petição inicial", descricao: "Petição inicial protocolada." }],
    questoesJuridicas: [{ ...CITACAO_OK, questao: "Prescrição da dívida." }],
    tesesPossiveis: [{ ...CITACAO_OK, tese: "Prescrição consumada.", fundamentacao: "Mais de 5 anos desde o vencimento." }],
    evidencias: [{ ...CITACAO_OK, descricao: "Contrato assinado anexado." }],
    contradicoes: [{ ...CITACAO_OK, descricao: "Datas divergentes entre petição e anexo." }],
    informacoesAusentes: ["Não há comprovante de citação do réu no processo."],
    riscos: [{ ...CITACAO_OK, descricao: "Risco de revelia não configurada corretamente.", nivel: "medio" as const }],
    prazosIdentificados: [
      { ...CITACAO_OK, titulo: "Prazo para resposta", data: "2026-02-10", descricao: "15 dias após citação." },
    ],
    proximasAcoes: [{ ...CITACAO_OK, acao: "Verificar certidão de citação nos autos." }],
    perguntasInvestigar: [{ ...CITACAO_OK, pergunta: "O réu já foi efetivamente citado?" }],
  };
}

describe("montarPromptAnaliseProcesso", () => {
  it("delimita o texto do documento com marcadores explícitos e página", () => {
    const prompt = montarPromptAnaliseProcesso({
      tipo: "texto",
      nomeArquivo: "processo.pdf",
      paginas: [{ pagina: 1, texto: "Conteúdo da página 1." }],
      truncado: false,
    });

    expect(prompt).toContain("===INÍCIO DO DOCUMENTO===");
    expect(prompt).toContain("===FIM DO DOCUMENTO===");
    expect(prompt).toContain("--- Página 1 ---");
    expect(prompt).toContain("Conteúdo da página 1.");
    const inicio = prompt.indexOf("===INÍCIO DO DOCUMENTO===");
    const fim = prompt.indexOf("===FIM DO DOCUMENTO===");
    expect(inicio).toBeLessThan(fim);
  });

  it("marca página null como documento sem paginação (DOCX)", () => {
    const prompt = montarPromptAnaliseProcesso({
      tipo: "texto",
      nomeArquivo: "peca.docx",
      paginas: [{ pagina: null, texto: "Texto corrido do docx." }],
      truncado: false,
    });

    expect(prompt).toContain("--- Documento (sem paginação) ---");
  });

  it("inclui aviso explícito de truncamento quando o documento excedeu o limite", () => {
    const prompt = montarPromptAnaliseProcesso({
      tipo: "texto",
      nomeArquivo: "processo-grande.pdf",
      paginas: [{ pagina: 1, texto: "x" }],
      truncado: true,
    });

    expect(prompt).toContain("AVISO");
    expect(prompt).toContain("truncado");
  });

  it("para imagem, não inclui bloco de documento e orienta pagina null", () => {
    const prompt = montarPromptAnaliseProcesso({ tipo: "imagem", nomeArquivo: "foto.jpg" });

    expect(prompt).not.toContain("===INÍCIO DO DOCUMENTO===");
    expect(prompt).toContain("IMAGEM");
    expect(prompt).toContain("pagina");
  });
});

describe("parsearRespostaAnaliseProcesso", () => {
  it("aceita uma resposta válida com as 12 seções", () => {
    const resultado = parsearRespostaAnaliseProcesso(respostaBaseValida());

    expect(resultado).not.toBeNull();
    expect(resultado?.resumoExecutivo).toContain("cobrança");
    expect(resultado?.linhaDoTempo).toHaveLength(1);
    expect(resultado?.informacoesAusentes).toHaveLength(1);
  });

  it("aceita certeza 'nao_encontrado' com trechoOriginal vazio", () => {
    const bruto = respostaBaseValida();
    bruto.questoesJuridicas = [
      { trechoOriginal: "", pagina: null, certeza: "nao_encontrado", questao: "Não há questão jurídica clara." },
    ];

    expect(parsearRespostaAnaliseProcesso(bruto)).not.toBeNull();
  });

  it("rejeita certeza 'confirmado' com trechoOriginal vazio (guardrail anti-alucinação)", () => {
    const bruto = respostaBaseValida();
    bruto.questoesJuridicas = [{ trechoOriginal: "", pagina: null, certeza: "confirmado", questao: "Algo inventado." }];

    expect(parsearRespostaAnaliseProcesso(bruto)).toBeNull();
  });

  it("rejeita certeza fora do enum", () => {
    const bruto = respostaBaseValida();
    bruto.riscos = [{ ...CITACAO_OK, certeza: "muito_certo", descricao: "x", nivel: "alto" }];

    expect(parsearRespostaAnaliseProcesso(bruto)).toBeNull();
  });

  it("rejeita quando falta uma das 12 seções obrigatórias", () => {
    const bruto = respostaBaseValida() as Record<string, unknown>;
    delete bruto.riscos;

    expect(parsearRespostaAnaliseProcesso(bruto)).toBeNull();
  });

  it("retorna null para shapes claramente inválidos", () => {
    expect(parsearRespostaAnaliseProcesso(null)).toBeNull();
    expect(parsearRespostaAnaliseProcesso("texto solto")).toBeNull();
    expect(parsearRespostaAnaliseProcesso({})).toBeNull();
  });
});
