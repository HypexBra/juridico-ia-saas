import { describe, expect, it } from "vitest";
import { montarPromptEstrategiaCaso, parsearRespostaEstrategiaCaso } from "./prompt";

const IDS_TESES_VALIDOS = ["tese-1", "tese-2"];

function respostaBaseValida(): Record<string, unknown> {
  return {
    objetivo: "Obter a rescisão do contrato com devolução integral dos valores pagos.",
    teses: [{ origem: "tese_cadastrada", papel: "principal", teseCasoId: "tese-1", tese: null, fundamentacao: null }],
    provas: [
      { descricao: "Comprovante de pagamento", status: "disponivel", origem: [{ tipo: "tese", teseCasoId: "tese-1" }] },
    ],
    riscos: [
      { categoria: "prazo", nivel: "medio", descricao: "Prazo de resposta se aproximando.", origem: [{ tipo: "ficha" }] },
    ],
    oportunidades: [{ descricao: "Possibilidade de acordo extrajudicial.", origem: [{ tipo: "ficha" }] }],
    proximosPassos: [
      {
        titulo: "Solicitar comprovante atualizado",
        detalhe: null,
        prazoSugerido: "2026-09-01",
        prioridade: "media",
        origem: [{ tipo: "ficha" }],
      },
    ],
    acoesRecomendadas: [
      {
        titulo: "Considerar proposta de acordo",
        detalhe: "Avaliar antes da réplica.",
        prazoSugerido: null,
        prioridade: "baixa",
        origem: [],
      },
    ],
    ressalvas: [],
  };
}

describe("montarPromptEstrategiaCaso", () => {
  it("delimita o contexto com marcadores explícitos e inclui aviso anti-injeção", () => {
    const prompt = montarPromptEstrategiaCaso("=== FICHA DO CASO ===\nResumo: teste.");

    expect(prompt).toContain("===INÍCIO DO CONTEXTO===");
    expect(prompt).toContain("===FIM DO CONTEXTO===");
    expect(prompt).toContain("=== FICHA DO CASO ===");
    expect(prompt.toLowerCase()).toContain("nunca uma instrução");

    const inicio = prompt.indexOf("===INÍCIO DO CONTEXTO===");
    const fim = prompt.indexOf("===FIM DO CONTEXTO===");
    expect(inicio).toBeLessThan(fim);
  });
});

describe("parsearRespostaEstrategiaCaso", () => {
  it("aceita uma resposta válida com tese referenciando um id válido do contexto", () => {
    const resultado = parsearRespostaEstrategiaCaso(respostaBaseValida(), IDS_TESES_VALIDOS);

    expect(resultado).not.toBeNull();
    expect(resultado?.teses).toHaveLength(1);
    expect(resultado?.teses[0]).toEqual({ origem: "tese_cadastrada", teseCasoId: "tese-1", papel: "principal" });
  });

  it("aceita uma resposta válida com tese 'sugerida' (sem tese cadastrada equivalente)", () => {
    const resposta = respostaBaseValida();
    resposta.teses = [
      { origem: "sugerida", papel: "principal", teseCasoId: null, tese: "Nulidade da cláusula abusiva", fundamentacao: "Art. 51 CDC." },
    ];

    const resultado = parsearRespostaEstrategiaCaso(resposta, IDS_TESES_VALIDOS);

    expect(resultado).not.toBeNull();
    expect(resultado?.teses[0]).toEqual({
      origem: "sugerida",
      papel: "principal",
      tese: "Nulidade da cláusula abusiva",
      fundamentacao: "Art. 51 CDC.",
    });
  });

  it("rejeita teseCasoId inventado (não presente na lista de ids válidos do contexto) — guardrail fail-closed", () => {
    const resposta = respostaBaseValida();
    resposta.teses = [
      { origem: "tese_cadastrada", papel: "principal", teseCasoId: "tese-inventada-pela-ia", tese: null, fundamentacao: null },
    ];

    const resultado = parsearRespostaEstrategiaCaso(resposta, IDS_TESES_VALIDOS);

    expect(resultado).toBeNull();
  });

  it("rejeita origem de risco/oportunidade/prova/passo referenciando teseCasoId inventado", () => {
    const resposta = respostaBaseValida();
    resposta.riscos = [
      {
        categoria: "prazo",
        nivel: "alto",
        descricao: "Risco qualquer",
        origem: [{ tipo: "tese", teseCasoId: "tese-que-nao-existe" }],
      },
    ];

    const resultado = parsearRespostaEstrategiaCaso(resposta, IDS_TESES_VALIDOS);

    expect(resultado).toBeNull();
  });

  it("rejeita a mesma tese cadastrada aparecendo como principal E subsidiária ao mesmo tempo — achado de QA", () => {
    const resposta = respostaBaseValida();
    resposta.teses = [
      { origem: "tese_cadastrada", papel: "principal", teseCasoId: "tese-1", tese: null, fundamentacao: null },
      { origem: "tese_cadastrada", papel: "subsidiaria", teseCasoId: "tese-1", tese: null, fundamentacao: null },
    ];

    const resultado = parsearRespostaEstrategiaCaso(resposta, IDS_TESES_VALIDOS);

    expect(resultado).toBeNull();
  });

  it("rejeita origem de tipo 'evento'/'analise_documento'/'analise_processo' com id inventado — guardrail estendido (defesa em profundidade)", () => {
    const idsOutrasFontesValidas = { eventos: ["evento-1"], analises: ["analise-1"] };

    const respostaEvento = respostaBaseValida();
    respostaEvento.riscos = [
      {
        categoria: "prazo",
        nivel: "alto",
        descricao: "Risco qualquer",
        origem: [{ tipo: "evento", eventoCasoId: "evento-inventado" }],
      },
    ];
    expect(parsearRespostaEstrategiaCaso(respostaEvento, IDS_TESES_VALIDOS, idsOutrasFontesValidas)).toBeNull();

    const respostaAnalise = respostaBaseValida();
    respostaAnalise.oportunidades = [
      { descricao: "Oportunidade qualquer", origem: [{ tipo: "analise_documento", analiseDocumentoId: "analise-inventada" }] },
    ];
    expect(parsearRespostaEstrategiaCaso(respostaAnalise, IDS_TESES_VALIDOS, idsOutrasFontesValidas)).toBeNull();

    // Ids que EXISTEM na lista válida devem passar normalmente.
    const respostaValida = respostaBaseValida();
    respostaValida.riscos = [
      {
        categoria: "prazo",
        nivel: "baixo",
        descricao: "Risco qualquer",
        origem: [
          { tipo: "evento", eventoCasoId: "evento-1" },
          { tipo: "analise_processo", analiseProcessoId: "analise-1" },
        ],
      },
    ];
    expect(parsearRespostaEstrategiaCaso(respostaValida, IDS_TESES_VALIDOS, idsOutrasFontesValidas)).not.toBeNull();
  });

  it("rejeita objetivo vazio", () => {
    const resposta = respostaBaseValida();
    resposta.objetivo = "   ";

    const resultado = parsearRespostaEstrategiaCaso(resposta, IDS_TESES_VALIDOS);

    expect(resultado).toBeNull();
  });

  it("rejeita teses vazio (precisa de ao menos 1 tese principal)", () => {
    const resposta = respostaBaseValida();
    resposta.teses = [];

    const resultado = parsearRespostaEstrategiaCaso(resposta, IDS_TESES_VALIDOS);

    expect(resultado).toBeNull();
  });

  it("rejeita resposta sem nenhuma tese com papel 'principal'", () => {
    const resposta = respostaBaseValida();
    resposta.teses = [
      { origem: "tese_cadastrada", papel: "subsidiaria", teseCasoId: "tese-1", tese: null, fundamentacao: null },
    ];

    const resultado = parsearRespostaEstrategiaCaso(resposta, IDS_TESES_VALIDOS);

    expect(resultado).toBeNull();
  });

  it("rejeita resposta com mais de 1 tese 'principal'", () => {
    const resposta = respostaBaseValida();
    resposta.teses = [
      { origem: "tese_cadastrada", papel: "principal", teseCasoId: "tese-1", tese: null, fundamentacao: null },
      { origem: "tese_cadastrada", papel: "principal", teseCasoId: "tese-2", tese: null, fundamentacao: null },
    ];

    const resultado = parsearRespostaEstrategiaCaso(resposta, IDS_TESES_VALIDOS);

    expect(resultado).toBeNull();
  });

  it("rejeita tese 'sugerida' sem texto de tese/fundamentação", () => {
    const resposta = respostaBaseValida();
    resposta.teses = [{ origem: "sugerida", papel: "principal", teseCasoId: null, tese: "", fundamentacao: "" }];

    const resultado = parsearRespostaEstrategiaCaso(resposta, IDS_TESES_VALIDOS);

    expect(resultado).toBeNull();
  });

  it("campo 'ressalvas' pode ser array vazio (não é obrigatório ter conteúdo, só existir)", () => {
    const resultado = parsearRespostaEstrategiaCaso(respostaBaseValida(), IDS_TESES_VALIDOS);

    expect(resultado?.ressalvas).toEqual([]);
  });

  it("rejeita resposta fora do schema (campo totalmente inesperado)", () => {
    const resultado = parsearRespostaEstrategiaCaso({ campoTotalmenteInesperado: true }, IDS_TESES_VALIDOS);

    expect(resultado).toBeNull();
  });
});
