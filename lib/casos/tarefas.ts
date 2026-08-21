import type { StatusTarefaCaso } from "@/lib/types";

const STATUS_TAREFA_VALIDOS: readonly StatusTarefaCaso[] = ["pendente", "em_andamento", "concluida"];

const TAMANHO_MAXIMO_TITULO = 255;

/** Type guard puro: valida se uma string arbitrária é um `StatusTarefaCaso` conhecido. */
export function statusTarefaCasoEhValido(status: string): status is StatusTarefaCaso {
  return (STATUS_TAREFA_VALIDOS as readonly string[]).includes(status);
}

export type NovaTarefaCasoInput = {
  escritorioId: string;
  fichaCasoId: string;
  titulo: string;
  responsavelPerfilId?: string | null;
  prazoOpcional?: string | null;
  criadoPor?: string | null;
};

export type NovaTarefaCasoPayload = {
  escritorio_id: string;
  ficha_caso_id: string;
  titulo: string;
  responsavel_perfil_id: string | null;
  status: "pendente";
  prazo_opcional: string | null;
  criado_por: string | null;
};

/**
 * Monta o payload de insert de uma nova linha em `tarefas_caso` (migration
 * 0027), validando o título (obrigatório, não vazio após trim, limitado ao
 * `varchar(255)` da coluna) antes de tocar o banco. Toda tarefa nasce com
 * status `pendente` — mover para `em_andamento`/`concluida` é sempre uma
 * ação explícita e posterior (ver `montarAtualizacaoStatusTarefa`).
 */
export function montarNovaTarefaCaso(input: NovaTarefaCasoInput): NovaTarefaCasoPayload {
  const titulo = input.titulo.trim();
  if (!titulo) {
    throw new Error("O título da tarefa não pode ser vazio.");
  }
  if (titulo.length > TAMANHO_MAXIMO_TITULO) {
    throw new Error(`O título da tarefa não pode ter mais de ${TAMANHO_MAXIMO_TITULO} caracteres.`);
  }

  return {
    escritorio_id: input.escritorioId,
    ficha_caso_id: input.fichaCasoId,
    titulo,
    responsavel_perfil_id: input.responsavelPerfilId?.trim() || null,
    status: "pendente",
    prazo_opcional: input.prazoOpcional?.trim() || null,
    criado_por: input.criadoPor ?? null,
  };
}

export type AtualizarStatusTarefaInput = {
  statusAtual: StatusTarefaCaso;
  novoStatus: string;
};

export type AtualizacaoStatusTarefaPayload = {
  status: StatusTarefaCaso;
};

/**
 * Valida e monta o payload de mudança de status de uma tarefa existente.
 * Rejeita valores fora do enum de `tarefas_caso` (mesmo check constraint do
 * banco, validado aqui antes do round-trip) e transições redundantes
 * (mesmo status atual e novo), que não representam nenhuma mudança real.
 */
export function montarAtualizacaoStatusTarefa(
  input: AtualizarStatusTarefaInput,
): AtualizacaoStatusTarefaPayload {
  if (!statusTarefaCasoEhValido(input.novoStatus)) {
    throw new Error("Status de tarefa inválido.");
  }
  if (input.novoStatus === input.statusAtual) {
    throw new Error("A tarefa já está com este status.");
  }

  return { status: input.novoStatus };
}

/**
 * Valida o identificador de responsável a atribuir a uma tarefa. `null`
 * (des-atribuir) é sempre válido; um id não vazio é aceito como está —
 * a existência do perfil e o isolamento por escritório são garantidos pela
 * FK (`responsavel_perfil_id references perfis`) e pela RLS no banco.
 */
export function validarResponsavelTarefaCaso(perfilId: string | null): string | null {
  if (perfilId === null) return null;
  const normalizado = perfilId.trim();
  if (!normalizado) {
    throw new Error("Identificador de responsável inválido.");
  }
  return normalizado;
}
