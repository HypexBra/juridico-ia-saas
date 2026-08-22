/**
 * Tipos do Workflow Engine (Fase 8, migration 0044, ADR
 * docs/adrs/0016-workflow-engine.md).
 *
 * Um workflow é uma SEQUÊNCIA FIXA de etapas (ordem 1..N) que o escritório
 * monta uma vez e executa N vezes sobre fichas de caso diferentes. Cada etapa
 * tem um `tipo_acao` e uma `configuracao` jsonb cujo shape depende do tipo —
 * esta união discriminada é o contrato ÚNICO entre o editor no client, o
 * validador puro (`lib/workflows/motor.ts`) e as server actions que executam
 * as etapas (`app/app/workflows/actions.ts`).
 *
 * Convenção de nomes em snake_case dentro da configuração: ela trafega como
 * jsonb na tabela `workflow_etapas.configuracao`, então mantém o mesmo
 * dialecto das colunas de banco (mesmo padrão dos demais jsonb do projeto,
 * ex: `variaveis_usadas`).
 */

/** Os 5 tipos de ação suportados — MESMO check constraint da migration 0044. */
export const TIPOS_ACAO_WORKFLOW = [
  "criar_tarefa",
  "criar_prazo",
  "gerar_documento",
  "mensagem_portal",
  "aprovar_humano",
] as const;

export type TipoAcaoWorkflow = (typeof TIPOS_ACAO_WORKFLOW)[number];

// ── Configuração por tipo de ação ───────────────────────────────────────

/** Cria uma tarefa operacional em `tarefas_caso` vinculada à ficha. */
export type ConfiguracaoCriarTarefa = {
  titulo_tarefa: string;
  /** Prazo opcional da tarefa, calculado como hoje + N dias na execução. */
  prazo_dias?: number;
};

/** Cria um prazo processual em `prazos` com data = início da execução + N dias. */
export type ConfiguracaoCriarPrazo = {
  titulo_prazo: string;
  dias_apos_inicio: number;
};

/** Gera documento via mail-merge condicional com um modelo do escritório. */
export type ConfiguracaoGerarDocumento = {
  modelo_id: string;
};

/** Envia mensagem ao cliente do portal vinculado à ficha (se houver). */
export type ConfiguracaoMensagemPortal = {
  texto: string;
};

/**
 * Pausa a execução até um humano confirmar — único ponto de
 * human-in-the-loop obrigatório da cadeia (ADR 0016, seção "human-in-the-loop").
 */
export type ConfiguracaoAprovarHumano = {
  instrucoes?: string;
};

/**
 * União discriminada da configuração por tipo — o campo discriminante é o
 * PRÓPRIO `tipo_acao` da etapa, embutido na configuração normalizada para
 * que o consumidor nunca precise casar `etapa.tipo_acao` com o shape à mão.
 */
export type ConfiguracaoAcao =
  | { tipo_acao: "criar_tarefa" } & ConfiguracaoCriarTarefa
  | { tipo_acao: "criar_prazo" } & ConfiguracaoCriarPrazo
  | { tipo_acao: "gerar_documento" } & ConfiguracaoGerarDocumento
  | { tipo_acao: "mensagem_portal" } & ConfiguracaoMensagemPortal
  | { tipo_acao: "aprovar_humano" } & ConfiguracaoAprovarHumano;

/** Etapa crua vinda do client/editor — configuração ainda não validada. */
export type EtapaInput = {
  ordem: number;
  tipo_acao: TipoAcaoWorkflow;
  titulo: string;
  configuracao: Record<string, unknown>;
};

// ── Rótulos pt-BR para a UI ─────────────────────────────────────────────

/** Rótulo curto por tipo — usado no editor, stepper e listagem. */
export const ROTULO_ACAO: Record<TipoAcaoWorkflow, string> = {
  criar_tarefa: "Criar tarefa",
  criar_prazo: "Criar prazo",
  gerar_documento: "Gerar documento",
  mensagem_portal: "Mensagem ao cliente",
  aprovar_humano: "Aprovação humana",
};

/** Descrição de uma linha — ajuda o usuário a escolher o tipo no editor. */
export const DESCRICAO_ACAO: Record<TipoAcaoWorkflow, string> = {
  criar_tarefa: "Cria uma tarefa operacional na checklist do caso.",
  criar_prazo: "Cria um prazo processual com data calculada a partir do início da execução.",
  gerar_documento: "Gera um documento a partir de um modelo (mail-merge condicional).",
  mensagem_portal: "Envia uma mensagem ao cliente pelo portal (se o caso tiver cliente convidado).",
  aprovar_humano: "Pausa a execução até alguém da equipe revisar e aprovar.",
};
