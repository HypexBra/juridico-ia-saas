import { describe, expect, it } from "vitest";
import { decidirContexto } from "./roteador-contexto";

describe("decidirContexto", () => {
  describe("modo rapido (interação social)", () => {
    it.each(["oi", "bom dia", "obrigado", "ok", "valeu", "beleza"])("%s", (texto) => {
      const d = decidirContexto(texto);
      expect(d.modo).toBe("rapido");
      expect(d.usarRag).toBe(false);
      expect(d.usarPesquisaWeb).toBe(false);
    });
  });

  describe("modo atualizado (depende do estado atual do mundo)", () => {
    it.each([
      "o STJ mudou o entendimento sobre dano moral em atraso de voo?",
      "essa súmula ainda está em vigor?",
      "qual a jurisprudência atual sobre usucapião extraordinária",
      "o tema 1046 se aplica a esse caso?",
      "qual a taxa Selic para correção monetária hoje",
      "houve alteração legislativa no prazo de prescrição?",
      "qual o teto do INSS",
      "o entendimento do STF sobre isso é esse mesmo?",
      "quais as últimas decisões sobre honorários sucumbenciais",
    ])("%s", (texto) => {
      const d = decidirContexto(texto);
      expect(d.modo).toBe("atualizado");
      expect(d.usarRag).toBe(true);
      expect(d.usarPesquisaWeb).toBe(true);
    });
  });

  describe("modo interno (material próprio, sem pesquisa web)", () => {
    it.each([
      "resuma o documento que eu subi",
      "reescreve esse parágrafo de forma mais formal",
      "quais são meus prazos dessa semana",
      "corrige a redação do texto acima",
      "liste minhas fichas de família",
      "melhore a redação desse trecho",
    ])("%s", (texto) => {
      const d = decidirContexto(texto);
      expect(d.modo).toBe("interno");
      expect(d.usarRag).toBe(true);
      expect(d.usarPesquisaWeb).toBe(false);
    });
  });

  it("recência vence trabalho interno quando os dois aparecem", () => {
    // "gere a peça" é trabalho interno, mas "mais recente" muda tudo:
    // responder sem pesquisar produziria uma peça com precedente velho.
    const d = decidirContexto("gere a petição citando a jurisprudência mais recente do STJ");
    expect(d.modo).toBe("atualizado");
  });

  it("pergunta jurídica genérica cai em interno, não em pesquisa web", () => {
    // Este é o caso que antes pagava grounding server-side de segundos sem
    // ganho nenhum: conceito estável, respondível com a base do escritório.
    const d = decidirContexto("qual o prazo para contestação no procedimento comum?");
    expect(d.modo).toBe("interno");
    expect(d.usarPesquisaWeb).toBe(false);
    expect(d.motivo).toBe("default_interno");
  });

  it("mensagem longa e desconhecida não vira trivial", () => {
    const d = decidirContexto("me ajuda a pensar em como abordar esse cliente difícil amanhã");
    expect(d.modo).not.toBe("rapido");
    expect(d.usarRag).toBe(true);
  });

  it("expõe o termo que motivou a decisão", () => {
    expect(decidirContexto("isso ainda vale?").motivo).toContain("recencia:");
    expect(decidirContexto("o que diz a súmula 7").motivo).toContain("fonte_mutavel:");
    expect(decidirContexto("resuma este contrato").motivo).toContain("trabalho_interno:");
  });

  it("palavra acentuada dispara o sinal (fronteira de palavra Unicode)", () => {
    // A fronteira de palavra do JavaScript e ASCII: com ela o padrao casa
    // "ultimas" sem acento mas nao "ultimas" com acento, porque o acento nao
    // e word char. Sem as fronteiras Unicode, metade das alternativas
    // acentuadas falharia em silencio e a mensagem cairia no modo errado.
    expect(decidirContexto("quais as últimas decisões sobre isso").modo).toBe("atualizado");
    expect(decidirContexto("houve mudança de entendimento").modo).toBe("atualizado");
  });

  it("não casa termo embutido em outra palavra", () => {
    // "contratual" contem "atual" no fim; a exigencia de palavra inteira
    // precisa valer dos dois lados da fronteira, nao so no fim.
    const d = decidirContexto("analise a cláusula contratual de rescisão");
    expect(d.modo).not.toBe("atualizado");
  });

  it("string vazia é trivial (não chama nada)", () => {
    expect(decidirContexto("   ").modo).toBe("rapido");
  });
});
