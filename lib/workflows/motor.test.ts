import { describe, expect, it } from "vitest";
import {
  avancarExecucao,
  normalizarConfiguracaoAcao,
  proximoIndiceAutomatico,
  resumoProgresso,
  validarConfiguracaoAcao,
  validarDefinicaoWorkflow,
  type MapaStatusPorOrdem,
} from "./motor";
import type { EtapaInput, TipoAcaoWorkflow } from "./tipos";

/** Fábrica de etapa com defaults sensatos — cada teste sobrescreve o necessário. */
function etapa(overrides: Partial<EtapaInput> & Pick<EtapaInput, "tipo_acao">): EtapaInput {
  const base: Record<TipoAcaoWorkflow, Record<string, unknown>> = {
    criar_tarefa: { titulo_tarefa: "Ligar para o cliente" },
    criar_prazo: { titulo_prazo: "Contestar", dias_apos_inicio: 15 },
    gerar_documento: { modelo_id: "0b8f6c1e-1111-4111-8111-000000000001" },
    mensagem_portal: { texto: "Seu caso avançou." },
    aprovar_humano: {},
  };
  return {
    ordem: 1,
    titulo: `Etapa ${overrides.tipo_acao}`,
    configuracao: base[overrides.tipo_acao],
    ...overrides,
  };
}

describe("validarDefinicaoWorkflow", () => {
  it("valida definição mista: título vazio falha, definição correta passa", () => {
    const resultado = validarDefinicaoWorkflow([
      etapa({ ordem: 1, tipo_acao: "gerar_documento" }),
      etapa({ ordem: 2, tipo_acao: "aprovar_humano", titulo: "Revisar minuta" }),
      etapa({ ordem: 3, tipo_acao: "criar_prazo" }),
      etapa({ ordem: 4, tipo_acao: "criar_tarefa", titulo: "" }), // título vazio deve falhar
    ]);
    // O caso acima TEM erro (título vazio) — assegurando que a validação não é decorativa.
    expect(resultado.ok).toBe(false);
    expect(resultado.erros).toHaveLength(1);

    const valido = validarDefinicaoWorkflow([
      etapa({ ordem: 1, tipo_acao: "criar_tarefa", titulo: "Separar documentos" }),
      etapa({ ordem: 2, tipo_acao: "aprovar_humano", titulo: "Conferir antes de protocolar" }),
    ]);
    expect(valido).toEqual({ ok: true, erros: [] });
  });

  it("exige pelo menos uma etapa", () => {
    const resultado = validarDefinicaoWorkflow([]);
    expect(resultado.ok).toBe(false);
    expect(resultado.erros.join(" ")).toContain("pelo menos uma etapa");
  });

  it("rejeita títulos vazios ou só de espaços", () => {
    const resultado = validarDefinicaoWorkflow([etapa({ titulo: "   ", tipo_acao: "criar_prazo" })]);
    expect(resultado.ok).toBe(false);
    expect(resultado.erros.some((erro) => erro.includes("título"))).toBe(true);
  });

  it("rejeita duplicidade de ordem", () => {
    const resultado = validarDefinicaoWorkflow([
      etapa({ ordem: 1, tipo_acao: "criar_tarefa" }),
      etapa({ ordem: 1, tipo_acao: "criar_prazo" }),
    ]);
    expect(resultado.ok).toBe(false);
    expect(resultado.erros.join(" ")).toContain("ordem 1");
  });

  it("valida config de criar_tarefa: título obrigatório e prazo_dias >= 0 inteiro", () => {
    const semTitulo = validarDefinicaoWorkflow([
      etapa({ tipo_acao: "criar_tarefa", configuracao: {} }),
    ]);
    expect(semTitulo.ok).toBe(false);
    expect(semTitulo.erros.join(" ")).toContain("titulo_tarefa");

    const prazoNegativo = validarDefinicaoWorkflow([
      etapa({ tipo_acao: "criar_tarefa", configuracao: { titulo_tarefa: "X", prazo_dias: -1 } }),
    ]);
    expect(prazoNegativo.ok).toBe(false);
    expect(prazoNegativo.erros.join(" ")).toContain("prazo_dias");

    const prazoFracionado = validarDefinicaoWorkflow([
      etapa({ tipo_acao: "criar_tarefa", configuracao: { titulo_tarefa: "X", prazo_dias: 2.5 } }),
    ]);
    expect(prazoFracionado.ok).toBe(false);
  });

  it("valida config de criar_prazo: título + dias_apos_inicio numérico >= 0", () => {
    const semDias = validarDefinicaoWorkflow([
      etapa({ tipo_acao: "criar_prazo", configuracao: { titulo_prazo: "Contestar" } }),
    ]);
    expect(semDias.ok).toBe(false);
    expect(semDias.erros.join(" ")).toContain("dias_apos_inicio");

    const diasTexto = validarDefinicaoWorkflow([
      etapa({ tipo_acao: "criar_prazo", configuracao: { titulo_prazo: "Contestar", dias_apos_inicio: "15" } }),
    ]);
    expect(diasTexto.ok).toBe(false);

    const valido = validarDefinicaoWorkflow([
      etapa({ tipo_acao: "criar_prazo", configuracao: { titulo_prazo: "Contestar", dias_apos_inicio: 0 } }),
    ]);
    expect(valido.ok).toBe(true);
  });

  it("valida config de gerar_documento: modelo_id precisa parecer um uuid", () => {
    const invalido = validarDefinicaoWorkflow([
      etapa({ tipo_acao: "gerar_documento", configuracao: { modelo_id: "modelo-1" } }),
    ]);
    expect(invalido.ok).toBe(false);
    expect(invalido.erros.join(" ")).toContain("modelo_id");

    const valido = validarDefinicaoWorkflow([
      etapa({
        tipo_acao: "gerar_documento",
        configuracao: { modelo_id: "9d2f0a44-abcd-4abc-9def-112233445566" },
      }),
    ]);
    expect(valido.ok).toBe(true);
  });

  it("valida config de mensagem_portal: texto obrigatório não vazio", () => {
    const vazio = validarDefinicaoWorkflow([
      etapa({ tipo_acao: "mensagem_portal", configuracao: { texto: "   " } }),
    ]);
    expect(vazio.ok).toBe(false);
    expect(vazio.erros.join(" ")).toContain("texto");
  });

  it("aceita config de aprovar_humano mesmo sem instruções (campo opcional)", () => {
    const semInstrucoes = validarDefinicaoWorkflow([etapa({ tipo_acao: "aprovar_humano", titulo: "Revisar" })]);
    expect(semInstrucoes.ok).toBe(true);

    const comInstrucoes = validarDefinicaoWorkflow([
      etapa({ tipo_acao: "aprovar_humano", titulo: "Revisar 2", configuracao: { instrucoes: "Checar cláusula 5" } }),
    ]);
    expect(comInstrucoes.ok).toBe(true);
  });

  it("rejeita tipo de ação fora da união conhecida (payload do client nunca é confiado)", () => {
    const estranha = { ordem: 1, tipo_acao: "apagar_tudo", titulo: "Estranha", configuracao: {} } as unknown as EtapaInput;
    const resultado = validarDefinicaoWorkflow([estranha]);
    expect(resultado.ok).toBe(false);
    expect(resultado.erros.join(" ")).toContain("Tipo de ação");
  });
});

describe("normalizarConfiguracaoAcao", () => {
  it("retorna configuração tipada quando válida e descarta campos extras", () => {
    const normalizada = normalizarConfiguracaoAcao("criar_tarefa", {
      titulo_tarefa: "Protocolar",
      prazo_dias: 10,
      campo_inventado: true,
    });
    expect(normalizada).toEqual({ tipo_acao: "criar_tarefa", titulo_tarefa: "Protocolar", prazo_dias: 10 });
  });

  it("retorna null quando a configuração não bate com o tipo", () => {
    expect(normalizarConfiguracaoAcao("criar_prazo", { titulo_prazo: "Sem dias" })).toBeNull();
    expect(normalizarConfiguracaoAcao("mensagem_portal", {})).toBeNull();
  });
});

describe("validarConfiguracaoAcao", () => {
  it("devolve lista de erros por tipo (vazia quando válido)", () => {
    expect(validarConfiguracaoAcao("gerar_documento", {})).toHaveLength(1);
    expect(
      validarConfiguracaoAcao("gerar_documento", { modelo_id: "9d2f0a44-abcd-4abc-9def-112233445566" }),
    ).toEqual([]);
    expect(validarConfiguracaoAcao("aprovar_humano", {})).toEqual([]);
  });
});

// ── Máquina de estados da execução ──────────────────────────────────────

const definicaoSimples = [
  etapa({ ordem: 1, tipo_acao: "criar_tarefa" }),
  etapa({ ordem: 2, tipo_acao: "criar_prazo" }),
  etapa({ ordem: 3, tipo_acao: "gerar_documento" }),
];

describe("avancarExecucao", () => {
  it("executa toda a sequência automática quando nada pausa", () => {
    const plano = avancarExecucao(definicaoSimples, { 1: "pendente", 2: "pendente", 3: "pendente" });
    expect(plano.executar).toEqual([1, 2, 3]);
    expect(plano.aguardandoHumano).toBeNull();
  });

  it("pausa em aprovar_humano pendente e retoma depois que o humano conclui", () => {
    const definicao = [
      ...definicaoSimples,
      etapa({ ordem: 4, tipo_acao: "aprovar_humano", titulo: "Revisar" }),
      etapa({ ordem: 5, tipo_acao: "mensagem_portal" }),
    ];

    const pausado = avancarExecucao(definicao, { 1: "pendente", 2: "pendente", 3: "pendente", 4: "pendente", 5: "pendente" });
    expect(pausado.executar).toEqual([1, 2, 3]);
    expect(pausado.aguardandoHumano).toBe(4);

    // Humano concluiu a etapa 4 → cadeia retoma na 5.
    const retomado = avancarExecucao(definicao, { 1: "concluida", 2: "concluida", 3: "concluida", 4: "concluida", 5: "pendente" });
    expect(retomado.executar).toEqual([5]);
    expect(retomado.aguardandoHumano).toBeNull();

    // Tudo concluído → nada a fazer.
    const finalizado = avancarExecucao(definicao, { 1: "concluida", 2: "concluida", 3: "concluida", 4: "concluida", 5: "concluida" });
    expect(finalizado.executar).toEqual([]);
    expect(finalizado.aguardandoHumano).toBeNull();
  });

  it("para a cadeia na primeira falha (etapas seguintes permanecem pendentes)", () => {
    const plano = avancarExecucao(definicaoSimples, { 1: "concluida", 2: "falha", 3: "pendente" });
    expect(plano.executar).toEqual([]);
    expect(plano.aguardandoHumano).toBeNull();
  });

  it("não executa nada quando há etapa executando em curso ou execução cancelada", () => {
    const emCurso = avancarExecucao(definicaoSimples, { 1: "concluida", 2: "executando", 3: "pendente" });
    expect(emCurso.executar).toEqual([]);

    const cancelada = avancarExecucao(definicaoSimples, { 1: "concluida", 2: "cancelada", 3: "pendente" });
    expect(cancelada.executar).toEqual([]);
  });

  it("ignora falhas antigas já superadas (retry concluiu a etapa e retoma)", () => {
    const plano = avancarExecucao(definicaoSimples, { 1: "concluida", 2: "concluida", 3: "pendente" });
    expect(plano.executar).toEqual([3]);
  });
});

describe("proximoIndiceAutomatico", () => {
  it("retorna a primeira ordem pendente a partir do índice informado", () => {
    const estados: MapaStatusPorOrdem = { 1: "concluida", 2: "falha", 3: "pendente", 4: "pendente" };
    expect(proximoIndiceAutomatico(estados, 1)).toBe(3);
    expect(proximoIndiceAutomatico(estados, 4)).toBe(4);
    expect(proximoIndiceAutomatico(estados, 5)).toBeNull();
  });
});

describe("resumoProgresso", () => {
  it("conta concluídas e aponta a etapa atual (primeira não resolvida)", () => {
    const resumo = resumoProgresso([
      { ordem: 1, status: "concluida" },
      { ordem: 2, status: "concluida" },
      { ordem: 3, status: "aguardando_humano" },
      { ordem: 4, status: "pendente" },
    ]);
    expect(resumo).toEqual({ total: 4, concluidas: 2, atual: 3 });
  });

  it("com tudo concluído, atual é null", () => {
    const resumo = resumoProgresso([
      { ordem: 1, status: "concluida" },
      { ordem: 2, status: "concluida" },
    ]);
    expect(resumo).toEqual({ total: 2, concluidas: 2, atual: null });
  });
});
