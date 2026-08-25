"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DESCRICAO_ACAO, ROTULO_ACAO, TIPOS_ACAO_WORKFLOW, type TipoAcaoWorkflow } from "@/lib/workflows/tipos";
import { salvarWorkflowAction } from "@/app/app/workflows/actions";

/**
 * Editor de workflow (Fase 8) — construtor de etapas com campos dinâmicos
 * por tipo de ação, reordenação manual (↑/↓) e remoção. Toda a VALIDAÇÃO
 * fina (configs por tipo, ordens duplicadas) vive no motor puro e roda na
 * action; aqui só há guardas de usabilidade (desabilitar submit, feedback).
 */

/** Configuração crua editável no form — sempre strings/numbers de input. */
type EtapaForm = {
  key: string;
  tipo_acao: TipoAcaoWorkflow;
  titulo: string;
  titulo_tarefa: string;
  prazo_dias: string;
  titulo_prazo: string;
  dias_apos_inicio: string;
  modelo_id: string;
  texto: string;
  instrucoes: string;
};

export type WorkflowParaEdicao = {
  id: string;
  nome: string;
  descricao: string | null;
  etapas: Array<{
    ordem: number;
    tipo_acao: string;
    titulo: string;
    configuracao: Record<string, unknown>;
  }>;
};

function novaEtapa(tipo: TipoAcaoWorkflow): EtapaForm {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tipo_acao: tipo,
    titulo: "",
    titulo_tarefa: "",
    prazo_dias: "",
    titulo_prazo: "",
    dias_apos_inicio: "",
    modelo_id: "",
    texto: "",
    instrucoes: "",
  };
}

/** Reconstrói o form a partir de um workflow salvo (modo edição). */
function etapasDoWorkflow(workflow: WorkflowParaEdicao): EtapaForm[] {
  return workflow.etapas.map((etapaAtual) => {
    const base = novaEtapa(etapaAtual.tipo_acao as TipoAcaoWorkflow);
    const config = etapaAtual.configuracao ?? {};
    return {
      ...base,
      titulo: etapaAtual.titulo,
      titulo_tarefa: typeof config.titulo_tarefa === "string" ? config.titulo_tarefa : "",
      prazo_dias: typeof config.prazo_dias === "number" ? String(config.prazo_dias) : "",
      titulo_prazo: typeof config.titulo_prazo === "string" ? config.titulo_prazo : "",
      dias_apos_inicio: typeof config.dias_apos_inicio === "number" ? String(config.dias_apos_inicio) : "",
      modelo_id: typeof config.modelo_id === "string" ? config.modelo_id : "",
      texto: typeof config.texto === "string" ? config.texto : "",
      instrucoes: typeof config.instrucoes === "string" ? config.instrucoes : "",
    };
  });
}

const inputClasse =
  "w-full rounded-md border border-ink/10 bg-navy px-3 py-2 text-sm text-ice placeholder:text-muted outline-none focus:border-silver/60";

export function WorkflowEditor({
  workflow,
  modelos,
  onFechar,
}: {
  /** `null` = criação; definido = edição. */
  workflow: WorkflowParaEdicao | null;
  modelos: Array<{ id: string; nome: string }>;
  onFechar: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const [nome, setNome] = useState(workflow?.nome ?? "");
  const [descricao, setDescricao] = useState(workflow?.descricao ?? "");
  const [etapas, setEtapas] = useState<EtapaForm[]>(workflow ? etapasDoWorkflow(workflow) : []);

  const podeSalvar = useMemo(() => {
    if (nome.trim().length === 0 || nome.trim().length > 120) return false;
    if (etapas.length === 0) return false;
    return etapas.every((etapaAtual) => etapaAtual.titulo.trim().length > 0);
  }, [nome, etapas]);

  function atualizarEtapa(key: string, mudancas: Partial<EtapaForm>) {
    setEtapas((atuais) => atuais.map((e) => (e.key === key ? { ...e, ...mudancas } : e)));
  }

  function mover(posicao: number, delta: -1 | 1) {
    setEtapas((atuais) => {
      const alvo = posicao + delta;
      if (alvo < 0 || alvo >= atuais.length) return atuais;
      const copia = [...atuais];
      const temporario = copia[posicao];
      const outro = copia[alvo];
      if (!temporario || !outro) return atuais;
      copia[posicao] = outro;
      copia[alvo] = temporario;
      return copia;
    });
  }

  /** Serializa o form para o contrato da action (config por tipo, campos extras fora). */
  function montarPayload() {
    return {
      id: workflow?.id ?? null,
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      etapas: etapas.map((etapaAtual, indice) => {
        // Ordem é derivada da POSIÇÃO na lista (fonte única de verdade do editor).
        const ordem = indice + 1;
        switch (etapaAtual.tipo_acao) {
          case "criar_tarefa":
            return {
              ordem,
              tipo_acao: etapaAtual.tipo_acao,
              titulo: etapaAtual.titulo.trim(),
              configuracao: {
                titulo_tarefa: etapaAtual.titulo_tarefa.trim(),
                ...(etapaAtual.prazo_dias.trim() ? { prazo_dias: Number(etapaAtual.prazo_dias) } : {}),
              },
            };
          case "criar_prazo":
            return {
              ordem,
              tipo_acao: etapaAtual.tipo_acao,
              titulo: etapaAtual.titulo.trim(),
              configuracao: {
                titulo_prazo: etapaAtual.titulo_prazo.trim(),
                dias_apos_inicio: Number(etapaAtual.dias_apos_inicio || 0),
              },
            };
          case "gerar_documento":
            return {
              ordem,
              tipo_acao: etapaAtual.tipo_acao,
              titulo: etapaAtual.titulo.trim(),
              configuracao: { modelo_id: etapaAtual.modelo_id },
            };
          case "mensagem_portal":
            return {
              ordem,
              tipo_acao: etapaAtual.tipo_acao,
              titulo: etapaAtual.titulo.trim(),
              configuracao: { texto: etapaAtual.texto.trim() },
            };
          case "aprovar_humano":
          default:
            return {
              ordem,
              tipo_acao: "aprovar_humano" as const,
              titulo: etapaAtual.titulo.trim(),
              configuracao: etapaAtual.instrucoes.trim() ? { instrucoes: etapaAtual.instrucoes.trim() } : {},
            };
        }
      }),
    };
  }

  function salvar() {
    setErro(null);
    startTransition(async () => {
      const resposta = await salvarWorkflowAction(montarPayload());
      if (!resposta.ok) {
        setErro(resposta.error);
        return;
      }
      onFechar();
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-ink/15 bg-navy-2/80 p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-lg font-semibold text-ice">
          {workflow ? "Editar workflow" : "Novo workflow"}
        </h3>
        <button
          type="button"
          onClick={onFechar}
          className="rounded-md border border-ink/10 px-2 py-1 text-xs text-muted hover:bg-ink/5 hover:text-ice"
        >
          Fechar
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-muted">
          Nome
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={120}
            placeholder="Ex.: Onboarding trabalhista"
            className={`mt-1 ${inputClasse}`}
          />
        </label>
        <label className="text-xs text-muted">
          Descrição (opcional)
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            maxLength={2000}
            placeholder="Quando este workflow deve ser usado?"
            className={`mt-1 ${inputClasse}`}
          />
        </label>
      </div>

      <div className="mt-5 space-y-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Etapas (executam na ordem)</p>

        {etapas.length === 0 && (
          <p className="rounded-md border border-dashed border-ink/10 px-3 py-4 text-center text-xs text-muted">
            Adicione a primeira etapa abaixo.
          </p>
        )}

        {etapas.map((etapaAtual, indice) => (
          /* Nó da etapa: card papel-2 com elevação sutil no hover. */
          <div key={etapaAtual.key} className="rounded-lg border border-ink/15 bg-paper-2 p-4 transition-shadow hover:shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-silver/15 text-xs font-semibold text-silver-2">
                {indice + 1}
              </span>

              <select
                value={etapaAtual.tipo_acao}
                onChange={(e) => atualizarEtapa(etapaAtual.key, { tipo_acao: e.target.value as TipoAcaoWorkflow })}
                className={`${inputClasse} max-w-52`}
                aria-label="Tipo de ação da etapa"
              >
                {TIPOS_ACAO_WORKFLOW.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {ROTULO_ACAO[tipo]}
                  </option>
                ))}
              </select>

              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => mover(indice, -1)}
                  disabled={indice === 0}
                  className="rounded border border-ink/10 px-2 py-1 text-xs text-muted hover:bg-ink/5 hover:text-ice disabled:opacity-30"
                  aria-label="Mover etapa para cima"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => mover(indice, 1)}
                  disabled={indice === etapas.length - 1}
                  className="rounded border border-ink/10 px-2 py-1 text-xs text-muted hover:bg-ink/5 hover:text-ice disabled:opacity-30"
                  aria-label="Mover etapa para baixo"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => setEtapas((atuais) => atuais.filter((e) => e.key !== etapaAtual.key))}
                  className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                  aria-label="Remover etapa"
                >
                  Remover
                </button>
              </div>
            </div>

            <p className="mt-2 text-xs text-muted">{DESCRICAO_ACAO[etapaAtual.tipo_acao]}</p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-muted sm:col-span-2">
                Título da etapa
                <input
                  value={etapaAtual.titulo}
                  onChange={(e) => atualizarEtapa(etapaAtual.key, { titulo: e.target.value })}
                  maxLength={200}
                  placeholder="Ex.: Gerar procuração"
                  className={`mt-1 ${inputClasse}`}
                />
              </label>

              {/* Campos dinâmicos por tipo — espelham ConfiguracaoAcao */}
              {etapaAtual.tipo_acao === "criar_tarefa" && (
                <>
                  <label className="text-xs text-muted">
                    Título da tarefa a criar
                    <input
                      value={etapaAtual.titulo_tarefa}
                      onChange={(e) => atualizarEtapa(etapaAtual.key, { titulo_tarefa: e.target.value })}
                      className={`mt-1 ${inputClasse}`}
                    />
                  </label>
                  <label className="text-xs text-muted">
                    Prazo da tarefa (dias a partir de hoje, opcional)
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={etapaAtual.prazo_dias}
                      onChange={(e) => atualizarEtapa(etapaAtual.key, { prazo_dias: e.target.value })}
                      className={`mt-1 ${inputClasse}`}
                    />
                  </label>
                </>
              )}

              {etapaAtual.tipo_acao === "criar_prazo" && (
                <>
                  <label className="text-xs text-muted">
                    Título do prazo a criar
                    <input
                      value={etapaAtual.titulo_prazo}
                      onChange={(e) => atualizarEtapa(etapaAtual.key, { titulo_prazo: e.target.value })}
                      className={`mt-1 ${inputClasse}`}
                    />
                  </label>
                  <label className="text-xs text-muted">
                    Dias após o INÍCIO da execução
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={etapaAtual.dias_apos_inicio}
                      onChange={(e) => atualizarEtapa(etapaAtual.key, { dias_apos_inicio: e.target.value })}
                      className={`mt-1 ${inputClasse}`}
                    />
                  </label>
                </>
              )}

              {etapaAtual.tipo_acao === "gerar_documento" && (
                <label className="text-xs text-muted sm:col-span-2">
                  Modelo (mail-merge condicional)
                  <select
                    value={etapaAtual.modelo_id}
                    onChange={(e) => atualizarEtapa(etapaAtual.key, { modelo_id: e.target.value })}
                    className={`mt-1 ${inputClasse}`}
                  >
                    <option value="">Selecione um modelo…</option>
                    {modelos.map((modelo) => (
                      <option key={modelo.id} value={modelo.id}>
                        {modelo.nome}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {etapaAtual.tipo_acao === "mensagem_portal" && (
                <label className="text-xs text-muted sm:col-span-2">
                  Texto da mensagem ao cliente
                  <textarea
                    value={etapaAtual.texto}
                    onChange={(e) => atualizarEtapa(etapaAtual.key, { texto: e.target.value })}
                    rows={3}
                    maxLength={2000}
                    className={`mt-1 ${inputClasse}`}
                  />
                </label>
              )}

              {etapaAtual.tipo_acao === "aprovar_humano" && (
                <label className="text-xs text-muted sm:col-span-2">
                  Instruções para quem aprova (opcional)
                  <textarea
                    value={etapaAtual.instrucoes}
                    onChange={(e) => atualizarEtapa(etapaAtual.key, { instrucoes: e.target.value })}
                    rows={2}
                    className={`mt-1 ${inputClasse}`}
                  />
                </label>
              )}
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setEtapas((atuais) => [...atuais, novaEtapa("criar_tarefa")])}
        >
          + Adicionar etapa
        </Button>
      </div>

      {erro && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onFechar} disabled={pending}>
          Cancelar
        </Button>
        <Button size="sm" onClick={salvar} disabled={!podeSalvar || pending}>
          {pending ? "Salvando…" : "Salvar workflow"}
        </Button>
      </div>
    </div>
  );
}
