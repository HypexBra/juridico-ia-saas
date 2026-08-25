import { describe, it, expect } from "vitest";
import { classificarIntencao, rotaParaDestino } from "./orquestrador";

describe("classificarIntencao — roteamento por rota", () => {
  it("pesquisa_juridica: 'jurisprudência do STJ' → alta (2 sinais fortes)", () => {
    const sugestao = classificarIntencao("buscar jurisprudência do STJ sobre danos morais");
    expect(sugestao).not.toBeNull();
    expect(sugestao?.rota).toBe("pesquisa_juridica");
    expect(sugestao?.confianca).toBe("alta");
  });

  it("estrategia_caso: 'probabilidade de êxito' → média (1 sinal forte)", () => {
    const sugestao = classificarIntencao("qual a probabilidade de êxito nesse caso");
    expect(sugestao?.rota).toBe("estrategia_caso");
    expect(sugestao?.confianca).toBe("media");
  });

  it("gerar_documento: 'redigir minuta de contrato' → alta", () => {
    const sugestao = classificarIntencao("preciso redigir minuta de contrato de locação");
    expect(sugestao?.rota).toBe("gerar_documento");
    expect(sugestao?.confianca).toBe("alta");
  });

  it("auditoria_peca: 'revisar peça e consistência' → alta; 'auditar peça' → média", () => {
    const alta = classificarIntencao("revisar peça e checar consistência antes do protocolo");
    expect(alta?.rota).toBe("auditoria_peca");
    expect(alta?.confianca).toBe("alta");

    const media = classificarIntencao("auditar peça de indenização");
    expect(media?.rota).toBe("auditoria_peca");
    expect(media?.confianca).toBe("media");
  });

  it("advogado_contra: 'atacar a tese da parte contrária' vence a estratégia (específico > genérico)", () => {
    const sugestao = classificarIntencao("como atacar a tese da parte contrária");
    expect(sugestao?.rota).toBe("advogado_contra");
    expect(sugestao?.confianca).toBe("alta");
  });

  it("advogado_contra: 'argumentar contra a tese' não cai em estrategia_caso (empate desempatado por prioridade)", () => {
    const sugestao = classificarIntencao("quero argumentar contra a tese inicial");
    expect(sugestao?.rota).toBe("advogado_contra");
  });

  it("calculadora: 'calcular juros e dias úteis' → alta; vence prazos_radar no conflito de 'prazo'", () => {
    const sugestao = classificarIntencao("calcular juros com prazo em dias úteis");
    expect(sugestao?.rota).toBe("calculadora");
    expect(sugestao?.confianca).toBe("alta");
  });

  it("prazos_radar: 'movimentação no diário oficial' → alta; 'prazos vencendo' → alta", () => {
    const diario = classificarIntencao("houve movimentação no diário oficial do processo?");
    expect(diario?.rota).toBe("prazos_radar");
    expect(diario?.confianca).toBe("alta");

    const vencendo = classificarIntencao("tem prazo vencendo amanhã?");
    expect(vencendo?.rota).toBe("prazos_radar");
    // "prazo" + "vencendo" são dois sinais fortes da mesma rota.
    expect(vencendo?.confianca).toBe("alta");
  });

  it("conflito calculadora × prazos_radar: 'dias úteis' sozinho é calculadora, não radar", () => {
    const sugestao = classificarIntencao("quantidade de dias úteis entre as datas");
    expect(sugestao?.rota).toBe("calculadora");
    expect(sugestao?.confianca).toBe("media");
  });
});

describe("classificarIntencao — normalização pt-BR", () => {
  it("remove acentos e caixa: 'ACÓRDÃO' e 'Petição Inicial' casam igual a minúsculas sem acento", () => {
    const acordao = classificarIntencao("Analise esse ACÓRDÃO do tribunal");
    expect(acordao?.rota).toBe("pesquisa_juridica");

    const peticao = classificarIntencao("GERAR PETIÇÃO INICIAL agora");
    expect(peticao?.rota).toBe("gerar_documento");

    const procuracao = classificarIntencao("modelo de PROCURAÇÃO");
    expect(procuracao?.rota).toBe("gerar_documento");
  });

  it("hífen em 'contra-argumento' casa como espaço", () => {
    const sugestao = classificarIntencao("monte um contra-argumento sólido");
    expect(sugestao?.rota).toBe("advogado_contra");
  });
});

describe("classificarIntencao — casos nulos e baixa confiança", () => {
  it("texto sem relação com nenhuma rota → null", () => {
    expect(classificarIntencao("bom dia, tudo bem?")).toBeNull();
    expect(classificarIntencao("   ")).toBeNull();
    expect(classificarIntencao("")).toBeNull();
  });

  it("apenas sinal fraco → confiança 'baixa' com rota apontada", () => {
    const fraco = classificarIntencao("vi uma fraqueza no caso");
    expect(fraco?.rota).toBe("advogado_contra");
    expect(fraco?.confianca).toBe("baixa");
  });

  it("sinal fraco de documento ('documento' sem verbo de geração) → baixa", () => {
    const fraco = classificarIntencao("esse documento chegou hoje");
    expect(fraco?.rota).toBe("gerar_documento");
    expect(fraco?.confianca).toBe("baixa");
  });
});

describe("classificarIntencao — motivoCurto", () => {
  it("sempre ≤60 chars e cita o termo detectado", () => {
    const entradas = [
      "buscar jurisprudência do STJ sobre danos morais",
      "calcular honorários sucumbenciais atualizados",
      "movimentação no diário oficial",
      "atacar a tese da parte contrária com contra-argumento bem fundamentado",
      "fraqueza",
    ];
    for (const entrada of entradas) {
      const sugestao = classificarIntencao(entrada);
      expect(sugestao).not.toBeNull();
      expect(sugestao?.motivoCurto.length).toBeLessThanOrEqual(60);
      expect(sugestao?.motivoCurto.length).toBeGreaterThan(0);
      expect(sugestao?.motivoCurto).toContain('"');
    }
  });
});

describe("rotaParaDestino — mapa estático", () => {
  it("mapeia cada rota navegável para o destino real do app", () => {
    expect(rotaParaDestino("pesquisa_juridica")).toEqual({
      href: "/app/pesquisa",
      label: "Pesquisa Jurídica",
    });
    expect(rotaParaDestino("calculadora")).toEqual({ href: "/app/calculadoras", label: "Calculadoras" });
    expect(rotaParaDestino("prazos_radar")).toEqual({ href: "/app/prazos", label: "Prazos" });
    expect(rotaParaDestino("auditoria_peca")).toEqual({ href: "/app/auditor", label: "Auditar peça" });
    expect(rotaParaDestino("gerar_documento")).toEqual({
      href: "/app/modelos",
      label: "Modelos de documentos",
    });
  });

  it("estrategia_caso leva às fichas com nota 'abra o caso'", () => {
    const destino = rotaParaDestino("estrategia_caso");
    expect(destino?.href).toBe("/app/fichas");
    expect(destino?.nota).toBe("abra o caso");
  });

  it("chat não tem destino (sem tela própria)", () => {
    expect(rotaParaDestino("chat")).toBeNull();
  });
});
