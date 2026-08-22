/**
 * Motor PURO do Workflow Engine (Fase 8, ADR docs/adrs/0016-workflow-engine.md).
 *
 * Sem I/O e sem Supabase — mesma filosofia de `lib/mailmerge-condicional/motor.ts`
 * e `lib/casos/teses.ts`: toda regra de negócio decidível em memória vive aqui,
 * testável sem mock; as server actions (`app/app/workflows/actions.ts`) fazem
 * APENAS I/O e delegam as decisões a este módulo.
 *
 * ── Regras de execução (contrato da Fase 8) ──────────────────────────────
 *
 * 1. TODA etapa automática executa em sequência, uma após a outra.
 * 2. A ÚNICA ação que pausa a cadeia é `aprovar_humano`: quando ela é a
 *    próxima da fila, entra em `aguardando_humano` e só um humano retoma
 *    (human-in-the-loop por padrão).
 * 3. Erro numa etapa marca-a como `falha` com o motivo no jsonb `resultado`
 *    e PARA a cadeia: as etapas seguintes permanecem `pendente`. A EXECUÇÃO
 *    continua `em_andamento` de propósito — para permitir retry da etapa
 *    falhada sem reiniciar tudo do zero.
 * 4. Cancelamento é terminal: qualquer etapa `cancelada` congela o avanço
 *    (a action correspondente também encerra a execução inteira).
 */

import type { ConfiguracaoAcao, EtapaInput, TipoAcaoWorkflow } from "./tipos";
import { TIPOS_ACAO_WORKFLOW } from "./tipos";

// ── Validação de configuração por tipo ──────────────────────────────────

const PADRAO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * "Plausível" de propósito: NÃO consultamos a tabela `modelos` aqui (o motor
 * é puro) — validamos formato uuid, que já elimina typos grosseiros; a
 * EXISTÊNCIA do modelo no tenant é verificada na hora da execução pela action
 * (fonte de verdade real, com RLS ativo).
 */
function pareceUuid(valor: unknown): valor is string {
  return typeof valor === "string" && PADRAO_UUID.test(valor.trim());
}

function ehInteiroNaoNegativo(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isInteger(valor) && valor >= 0;
}

/** Mensagens de erro em pt-BR, prontas para exibição na UI do editor. */
export function validarConfiguracaoAcao(
  tipoAcao: TipoAcaoWorkflow,
  configuracao: Record<string, unknown>,
): string[] {
  const erros: string[] = [];

  switch (tipoAcao) {
    case "criar_tarefa": {
      const titulo = configuracao.titulo_tarefa;
      if (typeof titulo !== "string" || titulo.trim().length === 0) {
        erros.push("criar_tarefa exige 'titulo_tarefa' preenchido.");
      }
      if ("prazo_dias" in configuracao && configuracao.prazo_dias !== undefined && configuracao.prazo_dias !== null) {
        if (!ehInteiroNaoNegativo(configuracao.prazo_dias)) {
          erros.push("criar_tarefa: 'prazo_dias' deve ser um número inteiro maior ou igual a 0.");
        }
      }
      break;
    }
    case "criar_prazo": {
      const titulo = configuracao.titulo_prazo;
      if (typeof titulo !== "string" || titulo.trim().length === 0) {
        erros.push("criar_prazo exige 'titulo_prazo' preenchido.");
      }
      if (!ehInteiroNaoNegativo(configuracao.dias_apos_inicio)) {
        erros.push("criar_prazo exige 'dias_apos_inicio' numérico inteiro maior ou igual a 0.");
      }
      break;
    }
    case "gerar_documento": {
      if (!pareceUuid(configuracao.modelo_id)) {
        erros.push("gerar_documento exige 'modelo_id' no formato uuid.");
      }
      break;
    }
    case "mensagem_portal": {
      const texto = configuracao.texto;
      if (typeof texto !== "string" || texto.trim().length === 0) {
        erros.push("mensagem_portal exige 'texto' preenchido.");
      }
      break;
    }
    case "aprovar_humano": {
      // instrucoes é opcional; se vier, precisa ser texto.
      const instrucoes = configuracao.instrucoes;
      if (instrucoes !== undefined && instrucoes !== null && typeof instrucoes !== "string") {
        erros.push("aprovar_humano: 'instrucoes' deve ser texto.");
      }
      break;
    }
    default: {
      // Tipo fora da união conhecida (payload do client nunca é confiado).
      erros.push(`Tipo de ação desconhecido.`);
      break;
    }
  }

  return erros;
}

/**
 * Converte a configuração crua do client para o tipo fechado
 * `ConfiguracaoAcao`, descartando campos extras (defesa contra payload
 * malicioso/lixo de UI). Retorna `null` quando inválida — nunca lança.
 */
export function normalizarConfiguracaoAcao(
  tipoAcao: TipoAcaoWorkflow,
  configuracao: Record<string, unknown>,
): ConfiguracaoAcao | null {
  if (validarConfiguracaoAcao(tipoAcao, configuracao).length > 0) return null;

  switch (tipoAcao) {
    case "criar_tarefa": {
      const prazo = configuracao.prazo_dias;
      return {
        tipo_acao: "criar_tarefa",
        titulo_tarefa: String(configuracao.titulo_tarefa).trim(),
        ...(typeof prazo === "number" ? { prazo_dias: prazo } : {}),
      };
    }
    case "criar_prazo":
      return {
        tipo_acao: "criar_prazo",
        titulo_prazo: String(configuracao.titulo_prazo).trim(),
        dias_apos_inicio: configuracao.dias_apos_inicio as number,
      };
    case "gerar_documento":
      return { tipo_acao: "gerar_documento", modelo_id: String(configuracao.modelo_id).trim() };
    case "mensagem_portal":
      return { tipo_acao: "mensagem_portal", texto: String(configuracao.texto).trim() };
    case "aprovar_humano": {
      const instrucoes = configuracao.instrucoes;
      return {
        tipo_acao: "aprovar_humano",
        ...(typeof instrucoes === "string" && instrucoes.trim().length > 0 ? { instrucoes: instrucoes.trim() } : {}),
      };
    }
  }
}

// ── Validação da definição completa do workflow ─────────────────────────

export type ResultadoValidacaoDefinicao = { ok: boolean; erros: string[] };

/**
 * Valida a definição inteira antes de salvar: ≥1 etapa, títulos presentes,
 * configuração válida por tipo e ordens únicas. Acumula TODOS os erros
 * (não para no primeiro) — o editor mostra a lista completa de uma vez.
 */
export function validarDefinicaoWorkflow(etapas: readonly EtapaInput[]): ResultadoValidacaoDefinicao {
  const erros: string[] = [];

  if (etapas.length === 0) {
    return { ok: false, erros: ["O workflow precisa de pelo menos uma etapa."] };
  }

  const ordensVistas = new Set<number>();

  for (const etapaAtual of etapas) {
    const rotuloEtapa =
      typeof etapaAtual?.ordem === "number" && Number.isFinite(etapaAtual.ordem)
        ? `Etapa ${etapaAtual.ordem}`
        : "Etapa sem ordem";

    // Título: obrigatório, não vazio, teto da coluna varchar(200).
    const titulo = etapaAtual?.titulo;
    if (typeof titulo !== "string" || titulo.trim().length === 0) {
      erros.push(`${rotuloEtapa}: informe um título.`);
    } else if (titulo.trim().length > 200) {
      erros.push(`${rotuloEtapa}: título muito longo (máximo de 200 caracteres).`);
    }

    // Ordem: número positivo e único.
    if (!ehInteiroNaoNegativo(etapaAtual?.ordem)) {
      erros.push(`${rotuloEtapa}: ordem deve ser um número inteiro maior ou igual a 1.`);
    } else {
      if (ordensVistas.has(etapaAtual.ordem)) {
        erros.push(`Há mais de uma etapa na ordem ${etapaAtual.ordem} — reordene antes de salvar.`);
      }
      ordensVistas.add(etapaAtual.ordem);
    }

    // Tipo + configuração.
    if (!(TIPOS_ACAO_WORKFLOW as readonly string[]).includes(String(etapaAtual?.tipo_acao))) {
      erros.push(`${rotuloEtapa}: Tipo de ação desconhecido.`);
      continue;
    }
    for (const erroConfig of validarConfiguracaoAcao(etapaAtual.tipo_acao, etapaAtual.configuracao ?? {})) {
      erros.push(`${rotuloEtapa}: ${erroConfig}`);
    }
  }

  return { ok: erros.length === 0, erros };
}

// ── Máquina de estados da execução ──────────────────────────────────────

/** Espelha o check constraint de `workflow_execucao_etapas.status` (migration 0044). */
export type StatusEtapaExecucao =
  | "pendente"
  | "executando"
  | "aguardando_humano"
  | "concluida"
  | "falha"
  | "cancelada";

/** Definição mínima de etapa que a máquina de estados precisa conhecer. */
export type EtapaParaAvanco = Pick<EtapaInput, "ordem" | "tipo_acao">;

/** Mapa ordem → status atual das etapas instanciadas de uma execução. */
export type MapaStatusPorOrdem = Readonly<Record<number, StatusEtapaExecucao>>;

export type PlanoAvancoExecucao = {
  /**
   * Ordens que devem ser executadas automaticamente AGORA, em sequência
   * crescente — a action processa nesta ordem e PARA na primeira falha.
   */
  executar: number[];
  /**
   * Quando a próxima da fila é `aprovar_humano` pendente, esta é a sua ordem:
   * a action marca a etapa como `aguardando_humano` e a execução espera.
   */
  aguardandoHumano: number | null;
};

/** Ações manuais pausam a cadeia — única exceção à execução sequencial. */
export function ehAcaoManual(tipoAcao: TipoAcaoWorkflow): boolean {
  return tipoAcao === "aprovar_humano";
}

/**
 * Primeira ordem >= `aPartirDe` cuja etapa ainda está `pendente` (ou `null`
 * se não existe). Helper de varredura usado por `avancarExecucao`.
 */
export function proximoIndiceAutomatico(
  statusPorOrdem: MapaStatusPorOrdem,
  aPartirDe: number,
): number | null {
  const ordensCrescentes = Object.keys(statusPorOrdem)
    .map(Number)
    .filter((ordem) => ordem >= aPartirDe)
    .sort((a, b) => a - b);

  for (const ordem of ordensCrescentes) {
    if (statusPorOrdem[ordem] === "pendente") return ordem;
  }
  return null;
}

/**
 * Dado o estado ATUAL das etapas da execução, decide o que fazer agora:
 * a lista de automáticas consecutivas a rodar (parando antes da primeira
 * aprovação humana pendente) e, se for o caso, qual etapa humana ficou
 * aguardando. Estados que congelam o avanço (`falha`, `executando`,
 * `cancelada`, `aguardando_humano` ANTES da posição corrente — não deve
 * ocorrer, mas tratado por robustez) retornam plano vazio.
 */
export function avancarExecucao(
  definicao: readonly EtapaParaAvanco[],
  statusPorOrdem: MapaStatusPorOrdem,
): PlanoAvancoExecucao {
  const ordenadas = [...definicao].sort((a, b) => a.ordem - b.ordem);
  const tiposPorOrdem = new Map(ordenadas.map((etapaAtual) => [etapaAtual.ordem, etapaAtual.tipo_acao]));

  // Congelamentos globais: falha/executando/cancelada/aguardando_humano em
  // QUALQUER etapa significa que a cadeia não deve avançar por conta própria.
  // (Falha espera retry humano; cancelamento é terminal.)
  for (const status of Object.values(statusPorOrdem)) {
    if (status === "falha" || status === "executando" || status === "cancelada" || status === "aguardando_humano") {
      return { executar: [], aguardandoHumano: null };
    }
  }

  const primeiraPendente = proximoIndiceAutomatico(statusPorOrdem, 1);

  // Tudo resolvido (concluído) → nada a fazer.
  if (primeiraPendente === null) return { executar: [], aguardandoHumano: null };

  const executar: number[] = [];
  // Anotação explícita: sem ela o TS estreita para `number` e rejeita a
  // reatribuição de `null` no fim do laço.
  let cursor: number | null = primeiraPendente;

  while (cursor !== null) {
    const tipo = tiposPorOrdem.get(cursor);
    if (!tipo || !statusPorOrdem[cursor]) break;

    if (ehAcaoManual(tipo)) {
      // Pausa human-in-the-loop: a etapa humana NÃO entra nas automáticas.
      return { executar, aguardandoHumano: cursor };
    }

    executar.push(cursor);
    cursor = proximoIndiceAutomatico(statusPorOrdem, cursor + 1);
  }

  return { executar, aguardandoHumano: null };
}

// ── Resumo de progresso (UI) ────────────────────────────────────────────

export type ResumoProgresso = {
  total: number;
  concluidas: number;
  /** Ordem da etapa "corrente" (primeira não concluída), ou `null` se acabou. */
  atual: number | null;
};

/** Agregação pura usada pelo stepper visual do painel de execuções. */
export function resumoProgresso(
  etapas: ReadonlyArray<{ ordem: number; status: StatusEtapaExecucao }>,
): ResumoProgresso {
  const ordenadas = [...etapas].sort((a, b) => a.ordem - b.ordem);
  const total = ordenadas.length;
  let concluidas = 0;
  let atual: number | null = null;

  for (const etapaAtual of ordenadas) {
    if (etapaAtual.status === "concluida") {
      concluidas += 1;
      continue;
    }
    if (atual === null) atual = etapaAtual.ordem;
  }

  return { total, concluidas, atual };
}
