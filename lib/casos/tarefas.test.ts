import { describe, expect, it } from "vitest";
import {
  montarAtualizacaoStatusTarefa,
  montarNovaTarefaCaso,
  statusTarefaCasoEhValido,
  validarResponsavelTarefaCaso,
} from "./tarefas";

describe("statusTarefaCasoEhValido", () => {
  it("aceita os três status conhecidos", () => {
    expect(statusTarefaCasoEhValido("pendente")).toBe(true);
    expect(statusTarefaCasoEhValido("em_andamento")).toBe(true);
    expect(statusTarefaCasoEhValido("concluida")).toBe(true);
  });

  it("rejeita status desconhecidos", () => {
    expect(statusTarefaCasoEhValido("cancelada")).toBe(false);
    expect(statusTarefaCasoEhValido("")).toBe(false);
  });
});

describe("montarNovaTarefaCaso", () => {
  const baseInput = {
    escritorioId: "escritorio-1",
    fichaCasoId: "ficha-1",
    titulo: "Revisar contrato",
  };

  it("monta o payload com status inicial pendente e trims aplicados", () => {
    const payload = montarNovaTarefaCaso({ ...baseInput, titulo: "  Revisar contrato  " });

    expect(payload).toEqual({
      escritorio_id: "escritorio-1",
      ficha_caso_id: "ficha-1",
      titulo: "Revisar contrato",
      responsavel_perfil_id: null,
      status: "pendente",
      prazo_opcional: null,
      criado_por: null,
    });
  });

  it("lança erro quando o título é vazio", () => {
    expect(() => montarNovaTarefaCaso({ ...baseInput, titulo: "" })).toThrow(
      "O título da tarefa não pode ser vazio.",
    );
  });

  it("lança erro quando o título é só espaços em branco", () => {
    expect(() => montarNovaTarefaCaso({ ...baseInput, titulo: "   " })).toThrow(
      "O título da tarefa não pode ser vazio.",
    );
  });

  it("lança erro quando o título excede 255 caracteres", () => {
    expect(() => montarNovaTarefaCaso({ ...baseInput, titulo: "a".repeat(256) })).toThrow(
      "O título da tarefa não pode ter mais de 255 caracteres.",
    );
  });

  it("aceita título com exatamente 255 caracteres", () => {
    const titulo = "a".repeat(255);
    const payload = montarNovaTarefaCaso({ ...baseInput, titulo });
    expect(payload.titulo).toBe(titulo);
  });

  it("propaga responsavelPerfilId, prazoOpcional e criadoPor quando informados", () => {
    const payload = montarNovaTarefaCaso({
      ...baseInput,
      responsavelPerfilId: "perfil-1",
      prazoOpcional: "2026-09-01",
      criadoPor: "perfil-1",
    });

    expect(payload.responsavel_perfil_id).toBe("perfil-1");
    expect(payload.prazo_opcional).toBe("2026-09-01");
    expect(payload.criado_por).toBe("perfil-1");
  });
});

describe("montarAtualizacaoStatusTarefa", () => {
  it("monta o payload quando o novo status é válido e diferente do atual", () => {
    const payload = montarAtualizacaoStatusTarefa({
      statusAtual: "pendente",
      novoStatus: "em_andamento",
    });

    expect(payload).toEqual({ status: "em_andamento" });
  });

  it("lança erro quando o novo status não existe no enum", () => {
    expect(() =>
      montarAtualizacaoStatusTarefa({ statusAtual: "pendente", novoStatus: "cancelada" }),
    ).toThrow("Status de tarefa inválido.");
  });

  it("lança erro quando o novo status é igual ao atual", () => {
    expect(() =>
      montarAtualizacaoStatusTarefa({ statusAtual: "concluida", novoStatus: "concluida" }),
    ).toThrow("A tarefa já está com este status.");
  });
});

describe("validarResponsavelTarefaCaso", () => {
  it("aceita null (des-atribuir)", () => {
    expect(validarResponsavelTarefaCaso(null)).toBeNull();
  });

  it("aceita e normaliza um id válido", () => {
    expect(validarResponsavelTarefaCaso("  perfil-1  ")).toBe("perfil-1");
  });

  it("lança erro quando o id é uma string vazia/só espaços", () => {
    expect(() => validarResponsavelTarefaCaso("   ")).toThrow(
      "Identificador de responsável inválido.",
    );
  });
});
