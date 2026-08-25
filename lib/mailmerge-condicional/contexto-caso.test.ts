import { describe, expect, it } from "vitest";
import {
  montarContextoCaso,
  type EntradaMontagemContextoCaso,
  type EstrategiaProntaParaContexto,
} from "./contexto-caso";

/** Entrada vazia = ficha recém-criada, sem nenhuma tabela do Caso Inteligente preenchida. */
const ENTRADA_VAZIA: EntradaMontagemContextoCaso = {
  pessoas: [],
  eventos: [],
  teses: [],
  tarefas: [],
  estrategia: null,
};

describe("montarContextoCaso", () => {
  it("devolve totais zerados, coleções vazias e estratégia vazia para ficha recém-criada", () => {
    const contexto = montarContextoCaso(ENTRADA_VAZIA);

    expect(contexto.total_pessoas).toBe(0);
    expect(contexto.total_eventos).toBe(0);
    expect(contexto.total_tarefas).toBe(0);
    expect(contexto.total_teses).toBe(0);
    expect(contexto.estrategia_objetivo).toBe("");
    expect(contexto.estrategia_tese_principal).toBe("");
    expect(contexto.pessoas).toEqual([]);
    expect(contexto.eventos).toEqual([]);
    expect(contexto.teses).toEqual([]);
    expect(contexto.tarefas).toEqual([]);
  });

  it("mapeia pessoas com campos reais da migration 0023 e flags derivadas", () => {
    const contexto = montarContextoCaso({
      ...ENTRADA_VAZIA,
      pessoas: [
        {
          nome: "João Silva",
          tipo: "parte",
          documento: "123.456.789-00",
          contato: "(11) 99999-0000",
          papel_processual: "autor",
        },
        { nome: "Empresa XYZ", tipo: "adverso", documento: null, contato: null, papel_processual: null },
      ],
    });

    expect(contexto.total_pessoas).toBe(2);
    expect(contexto.pessoas).toHaveLength(2);
    // Índice 1-based explícito no registro (mesmo valor que o motor injeta em {{#cada}}).
    expect(contexto.pessoas[0]).toMatchObject({
      indice: 1,
      nome: "João Silva",
      tipo: "parte",
      papel_processual: "autor",
      documento: "123.456.789-00",
      contato: "(11) 99999-0000",
      adversa: false,
      tem_documento: true,
      tem_contato: true,
    });
    expect(contexto.pessoas[1]).toMatchObject({
      indice: 2,
      nome: "Empresa XYZ",
      tipo: "adverso",
      adversa: true,
      tem_documento: false,
      tem_contato: false,
    });
  });

  it("ordena eventos por data ascendente e marca 'ultimo' no mais recente", () => {
    const contexto = montarContextoCaso({
      ...ENTRADA_VAZIA,
      eventos: [
        {
          tipo_evento: "sentenca",
          descricao: "Sentença proferida",
          data_evento: "2026-05-10T12:00:00Z",
          origem: "documento",
        },
        {
          tipo_evento: "audiencia",
          descricao: "Audiência inicial",
          data_evento: "2026-02-01T12:00:00Z",
          origem: "manual",
        },
      ],
    });

    expect(contexto.eventos).toHaveLength(2);
    expect(contexto.eventos[0]).toMatchObject({
      indice: 1,
      data: "01/02/2026",
      descricao: "Audiência inicial",
      tipo_evento: "audiencia",
      origem: "manual",
      ultimo: false, // mais antigo
    });
    expect(contexto.eventos[1]).toMatchObject({
      indice: 2,
      data: "10/05/2026",
      descricao: "Sentença proferida",
      ultimo: true, // mais recente da linha do tempo
    });
  });

  it("mapeia teses com flag adotada e tarefas com prazo/concluida/atrasada derivados", () => {
    const contexto = montarContextoCaso({
      ...ENTRADA_VAZIA,
      teses: [
        {
          id: "id-tese-1",
          tese: "Verba indenizatória não sofre prescrição trintenária",
          fundamentacao: "STF RE 123456",
          status: "adotada",
        },
      ],
      tarefas: [
        { titulo: "Protocolizar inicial", status: "pendente", prioridade: "alta", prazo_opcional: "2019-01-10" },
        { titulo: "Ligar para cliente", status: "concluida", prioridade: "baixa", prazo_opcional: null },
      ],
    });

    expect(contexto.total_teses).toBe(1);
    expect(contexto.teses[0]).toMatchObject({
      indice: 1,
      tese: "Verba indenizatória não sofre prescrição trintenária",
      fundamentacao: "STF RE 123456",
      status: "adotada",
      adotada: true,
    });

    // Pendentes primeiro; atrasada deriva de prazo no passado + não concluída.
    expect(contexto.tarefas[0]).toMatchObject({
      indice: 1,
      titulo: "Protocolizar inicial",
      status: "pendente",
      prioridade: "alta",
      prazo: "10/01/2019",
      concluida: false,
      atrasada: true,
    });
    expect(contexto.tarefas[1]).toMatchObject({
      indice: 2,
      titulo: "Ligar para cliente",
      concluida: true,
      atrasada: false, // concluída nunca é atrasada, mesmo sem prazo
    });
  });

  it("ordena tarefas pendentes primeiro, por prioridade desc e prazo mais próximo", () => {
    const contexto = montarContextoCaso({
      ...ENTRADA_VAZIA,
      tarefas: [
        // Fora de ordem de propósito: concluída alta prioridade primeiro na entrada.
        { titulo: "Arquivar docs", status: "concluida", prioridade: "alta", prazo_opcional: "2020-01-01" },
        { titulo: "Revisar contrato", status: "pendente", prioridade: "media", prazo_opcional: "2099-06-20" },
        { titulo: "Protocolizar inicial", status: "pendente", prioridade: "alta", prazo_opcional: "2099-01-15" },
        { titulo: "Sem prazo definido", status: "pendente", prioridade: "alta", prazo_opcional: null },
        { titulo: "Baixa urgência", status: "em_andamento", prioridade: "baixa", prazo_opcional: "2099-03-03" },
      ],
    });

    expect(contexto.tarefas.map((tarefa) => tarefa.titulo)).toEqual([
      "Protocolizar inicial", // ativa, prioridade alta, prazo mais próximo
      "Sem prazo definido", // ativa, prioridade alta, sem prazo → depois das com prazo
      "Revisar contrato", // ativa, prioridade média
      "Baixa urgência", // ativa, prioridade baixa
      "Arquivar docs", // concluída sempre por último
    ]);
  });

  it("extrai objetivo e tese principal sugerida da estratégia pronta", () => {
    const estrategia: EstrategiaProntaParaContexto = {
      resultado_estrategia: {
        objetivo: "Obter reconhecimento de vínculo empregatício.",
        teses: [{ origem: "sugerida", papel: "principal", tese: "Desvio de função configura vínculo." }],
      },
    };

    const contexto = montarContextoCaso({ ...ENTRADA_VAZIA, estrategia });

    expect(contexto.estrategia_objetivo).toBe("Obter reconhecimento de vínculo empregatício.");
    expect(contexto.estrategia_tese_principal).toBe("Desvio de função configura vínculo.");
  });

  it("resolve tese principal por referência contra as teses da própria ficha", () => {
    const estrategia: EstrategiaProntaParaContexto = {
      resultado_estrategia: {
        objetivo: "Êxito na reclamação trabalhista.",
        teses: [{ origem: "tese_cadastrada", teseCasoId: "id-tese-viva", papel: "principal" }],
      },
    };
    const entrada: EntradaMontagemContextoCaso = {
      ...ENTRADA_VAZIA,
      teses: [{ id: "id-tese-viva", tese: "Horas extras integram o salário-base.", fundamentacao: null, status: "adotada" }],
      estrategia,
    };

    const contexto = montarContextoCaso(entrada);
    expect(contexto.estrategia_tese_principal).toBe("Horas extras integram o salário-base.");

    // ID que não existe na ficha → vazio ("não informado" no motor), nunca exceção.
    const comIdFantasma = montarContextoCaso({ ...entrada, teses: [] });
    expect(comIdFantasma.estrategia_tese_principal).toBe("");
  });

  it("tolera jsonb malformado/parcial da estratégia sem lançar erro", () => {
    const casosMalformados: unknown[] = [
      null,
      "texto solto",
      {},
      { objetivo: 42, teses: "não é array" },
      { objetivo: "", teses: [{ papel: "principal" }] },
      { objetivo: "Objetivo válido", teses: [{ origem: "sugerida", papel: "secundaria", tese: "outra" }] },
    ];

    for (const jsonb of casosMalformados) {
      const contexto = montarContextoCaso({
        ...ENTRADA_VAZIA,
        estrategia: { resultado_estrategia: jsonb },
      });
      // Nenhuma combinação pode quebrar a geração: pior caso é string vazia.
      expect(typeof contexto.estrategia_objetivo).toBe("string");
      expect(typeof contexto.estrategia_tese_principal).toBe("string");
    }
  });
});
