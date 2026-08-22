"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  alternarWorkflowAtivoAction,
  excluirWorkflowAction,
  iniciarExecucaoAction,
} from "@/app/app/workflows/actions";
import { WorkflowEditor, type WorkflowParaEdicao } from "@/components/app/workflow-editor";
import { WorkflowExecucoes, type ExecucaoView } from "@/components/app/workflow-execucoes";
import { ROTULO_ACAO, type TipoAcaoWorkflow } from "@/lib/workflows/tipos";

/**
 * Painel da página /app/workflows (Fase 8): listagem de workflows com as
 * ações por linha (editar, ativar/pausar, excluir, executar) + seletor de
 * caso inline para disparar a execução + painel de execuções recentes.
 * O editor abre INLINE (mesmo padrão de seções expansíveis das demais
 * páginas) — menos rotas, menos superfície.
 */

export type WorkflowListaItem = WorkflowParaEdicao & {
  ativo: boolean;
  /** ISO — só para exibição na listagem. */
  criado_em: string;
};

export type FichaOpcao = {
  id: string;
  nome_cliente: string | null;
  area_direito: string | null;
};

/** Etapa da DEFINIÇÃO (para leitura em linha e modo edição). */
export type EtapaDefinicaoView = {
  ordem: number;
  tipo_acao: string;
  titulo: string;
  configuracao: Record<string, unknown>;
};

const dataBr = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

export function WorkflowsPainel({
  workflows,
  etapasPorWorkflow,
  execucoes,
  fichas,
  modelos,
}: {
  workflows: WorkflowListaItem[];
  /** Etapas da DEFINIÇÃO por workflow_id (leitura em linha + modo edição). */
  etapasPorWorkflow: Record<string, EtapaDefinicaoView[]>;
  execucoes: ExecucaoView[];
  fichas: FichaOpcao[];
  /** Modelos disponíveis para etapas de geração de documento. */
  modelos: Array<{ id: string; nome: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [editorAberto, setEditorAberto] = useState<{ novo: boolean; workflow: WorkflowParaEdicao | null } | null>(null);
  const [executandoId, setExecutandoId] = useState<string | null>(null);
  const [fichaSelecionada, setFichaSelecionada] = useState<string>("");
  const [erro, setErro] = useState<string | null>(null);

  function rodar(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setErro(null);
    startTransition(async () => {
      const resposta = await fn();
      if (!resposta.ok) {
        setErro(resposta.error ?? "Falha inesperada.");
        return;
      }
      router.refresh();
    });
  }

  function iniciarExecucao(workflowId: string) {
    if (!fichaSelecionada) return;
    rodar(async () => {
      const resposta = await iniciarExecucaoAction(workflowId, fichaSelecionada);
      if (resposta.ok) {
        setExecutandoId(null);
        setFichaSelecionada("");
      }
      return resposta;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {workflows.length} workflow{workflows.length === 1 ? "" : "s"} no escritório
        </p>
        <Button size="sm" onClick={() => setEditorAberto({ novo: true, workflow: null })}>
          Novo workflow
        </Button>
      </div>

      {erro && (
        <p className="rounded-md border border-red-500/30 bg-red-950/30 px-3 py-2 text-xs text-red-300">{erro}</p>
      )}

      {editorAberto && (
        <WorkflowEditor workflow={editorAberto.workflow} modelos={modelos} onFechar={() => setEditorAberto(null)} />
      )}

      <div className="space-y-3">
        {workflows.length === 0 && (
          <p className="rounded-md border border-dashed border-white/10 px-3 py-6 text-center text-xs text-muted">
            Nenhum workflow ainda. Crie o primeiro com rotinas que você repete caso a caso.
          </p>
        )}

        {workflows.map((workflow) => {
          const etapasDefinicao = etapasPorWorkflow[workflow.id] ?? [];
          const selecionando = executandoId === workflow.id;

          return (
            <div key={workflow.id} className="rounded-xl border border-white/10 bg-navy-2/60 p-4">
              <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                <h3 className="font-display text-base font-semibold text-ice">{workflow.nome}</h3>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                    workflow.ativo
                      ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-300"
                      : "border-white/10 bg-white/5 text-muted"
                  }`}
                >
                  {workflow.ativo ? "Ativo" : "Pausado"}
                </span>
                <span className="text-xs text-muted">criado em {dataBr(workflow.criado_em)}</span>

                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <Button variant="secondary" size="sm" disabled={pending || !workflow.ativo || fichas.length === 0} onClick={() => { setExecutandoId(selecionando ? null : workflow.id); setFichaSelecionada(""); }}>
                    Executar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => setEditorAberto({ novo: false, workflow })}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => rodar(() => alternarWorkflowAtivoAction(workflow.id, !workflow.ativo))}
                  >
                    {workflow.ativo ? "Pausar" : "Ativar"}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={pending}
                    onClick={() => rodar(() => excluirWorkflowAction(workflow.id))}
                  >
                    Excluir
                  </Button>
                </div>
              </div>

              {workflow.descricao && <p className="mt-1 text-sm text-muted">{workflow.descricao}</p>}

              {/* Definição em linha — leitura rápida sem abrir o editor. */}
              {etapasDefinicao.length > 0 && (
                <ol className="mt-3 flex flex-wrap gap-2">
                  {[...etapasDefinicao]
                    .sort((a, b) => a.ordem - b.ordem)
                    .map((etapaAtual, indice) => (
                      <li
                        key={`${workflow.id}-${etapaAtual.ordem}`}
                        className="rounded-md border border-white/10 bg-navy px-2 py-1 text-xs text-silver-2"
                      >
                        <span className="text-muted">{indice + 1}.</span>{" "}
                        {ROTULO_ACAO[etapaAtual.tipo_acao as TipoAcaoWorkflow] ?? etapaAtual.tipo_acao}
                        <span className="text-muted"> · {etapaAtual.titulo}</span>
                      </li>
                    ))}
                </ol>
              )}

              {selecionando && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-navy p-3">
                  <label className="text-xs text-muted">
                    Caso alvo
                    <select
                      value={fichaSelecionada}
                      onChange={(e) => setFichaSelecionada(e.target.value)}
                      className="mt-1 w-full min-w-64 rounded-md border border-white/10 bg-navy px-3 py-2 text-sm text-ice outline-none focus:border-silver/60"
                    >
                      <option value="">Selecione um caso…</option>
                      {fichas.map((ficha) => (
                        <option key={ficha.id} value={ficha.id}>
                          {ficha.nome_cliente ?? "(sem nome)"}
                          {ficha.area_direito ? ` · ${ficha.area_direito}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="ml-auto flex items-center gap-2">
                    <Link href="/app/fichas" className="text-xs text-muted underline underline-offset-2 hover:text-ice">
                      Gerenciar casos
                    </Link>
                    <Button size="sm" disabled={!fichaSelecionada || pending} onClick={() => iniciarExecucao(workflow.id)}>
                      {pending ? "Executando…" : "Disparar"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setExecutandoId(null)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-ice">Execuções recentes</h2>
        <WorkflowExecucoes execucoes={execucoes} />
      </section>
    </div>
  );
}
