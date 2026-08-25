import { describe, it, expect } from "vitest";
import { parseDataStj, mapearEspelhoParaInput, escolherArquivoMaisRecente } from "./stj";

describe("parseDataStj", () => {
  it("extrai data do formato real de dataPublicacao dos espelhos STJ", () => {
    expect(parseDataStj("DJEN       DATA:03/06/2026")).toBe("2026-06-03");
  });

  it("aceita datas BR simples e ISO", () => {
    expect(parseDataStj("03/06/2026")).toBe("2026-06-03");
    expect(parseDataStj("2026-06-03")).toBe("2026-06-03");
  });

  it("devolve undefined para lixo/vazio sem lançar", () => {
    expect(parseDataStj(null)).toBeUndefined();
    expect(parseDataStj("")).toBeUndefined();
    expect(parseDataStj("sem data aqui")).toBeUndefined();
  });
});

describe("mapearEspelhoParaInput", () => {
  const registroBase = {
    id: "960025",
    numeroProcesso: "3637",
    numeroRegistro: "202600409527",
    siglaClasse: "AgInt na SS",
    nomeOrgaoJulgador: "CORTE ESPECIAL",
    ministroRelator: "HERMAN BENJAMIN",
    dataPublicacao: "DJEN       DATA:03/06/2026",
    ementa:
      "PROCESSUAL CIVIL E ADMINISTRATIVO. AGRAVO INTERNO EM SUSPENSÃO DE SEGURANÇA. LICITAÇÃO PARA CONSTRUÇÃO DE HOSPITAL. RISCO DEMONSTRADO. DEFERIMENTO PARCIAL DA CONTRACAUTELA.",
  };

  it("mapeia registro completo preservando metadados oficiais", () => {
    const input = mapearEspelhoParaInput(registroBase);
    expect(input).not.toBeNull();
    expect(input?.tribunal).toBe("stj");
    expect(input?.numero_processo).toBe("3637");
    expect(input?.relator).toBe("HERMAN BENJAMIN");
    expect(input?.data_publicacao).toBe("2026-06-03");
    expect((input as Record<string, unknown>).orgao_julgador).toBe("CORTE ESPECIAL");
    expect((input as Record<string, unknown>).origem).toBe("stj_dados_abertos");
  });

  it("recusa registro SEM ementa ou com ementa trivial (não citável)", () => {
    expect(mapearEspelhoParaInput({ ...registroBase, ementa: null })).toBeNull();
    expect(mapearEspelhoParaInput({ ...registroBase, ementa: "curta" })).toBeNull();
    expect(mapearEspelhoParaInput({ ...registroBase, numeroProcesso: null })).toBeNull();
  });

  it("normaliza tema numérico e ignora tema inválido", () => {
    const comTema = mapearEspelhoParaInput({ ...registroBase, tema: 987 });
    expect((comTema as Record<string, unknown>).tema).toBe(987);
    const temaString = mapearEspelhoParaInput({ ...registroBase, tema: "987" });
    expect((temaString as Record<string, unknown>).tema).toBe(987);
    const temaLixo = mapearEspelhoParaInput({ ...registroBase, tema: "sem tema" });
    expect((temaLixo as Record<string, unknown>).tema).toBeUndefined();
  });
});

describe("escolherArquivoMaisRecente", () => {
  it("escolhe o JSON mais recente pelo nome AAAAMMDD e ignora ZIP/CSV", () => {
    const escolhido = escolherArquivoMaisRecente([
      { format: "ZIP", name: "20220507.zip", url: "https://x/20220507.zip" },
      { format: "CSV", name: "dicionario.csv", url: "https://x/d.csv" },
      { format: "JSON", name: "20220531.json", url: "https://x/20220531.json" },
      { format: "JSON", name: "20260630.json", url: "https://x/20260630.json" },
    ]);
    expect(escolhido?.nome).toBe("20260630.json");
  });

  it("devolve null quando não há JSON", () => {
    expect(escolherArquivoMaisRecente([{ format: "ZIP", name: "a.zip", url: "https://x/a.zip" }])).toBeNull();
  });
});
