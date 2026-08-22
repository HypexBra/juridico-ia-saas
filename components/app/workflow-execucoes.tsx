"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ROTULO_ACAO, type TipoAcaoWorkflow } from "@/lib/workflows/tipos";
import {
  cancelarExecucaoAction,
  concluirEtapaHumanaAction,
  reprocessarEtapaAction,
} from "@/app/app/workflows/actions";
import { resumoProgresso, type StatusEtapaExecucao } from "@/lib/workflows/motor";

/**
 * Painel de execuções recentes (Fase 8) — stepper visual por execução:
 * cada etapa mostra ícone/status/resultado curto e os botões que couberem
 * (Concluir aprovação / Reprocessar falha). Cancelar fica no cabeçalho da
 * execução enquanto ela estiver em andamento. Painel inline na MESMA página
 * (decisão do design: menos rotas = menos superfície).
 */

export type EtapaExecucaoView = {
  id: string;
  execucao_id: string;
  ordem: number;
  tipo_acao: string;
  titulo: string;
  status: string;
  resultado: Record<string, unknown> | null;
};

export type ExecucaoView = {
  id: string;
  workflow_nome: string;
  ficha_caso_id: string;
  nome_cliente: string | null;
  status: string;
  criado_em: string;
  etapas: EtapaExecucaoView[];
};

const STATUS_ETIQUETA: Record<StatusEtapaExecucao, string> = {
  pendente: "Pendente",
  executando: "Executando…",
  aguardando_humano: "Aguardando você",
  concluida: "Concluída",
  falha: "Falhou",
  cancelada: "Cancelada",
};

/** Cores por status — paleta navy do tema (sem cores fora do sistema). */
function corStatus(status: StatusEtapaExecucao): string {
  switch (status) {
    case "concluida":
      return "border-emerald-500/30 bg-emerald-950/20 text-emerald-300";
    case "falha":
      return "border-red-500/30 bg-red-950/30 text-red-300";
    case "aguardando_humano":
      return "border-amber-500/30 bg-amber-950/20 text-amber-300";
    case "executando":
      return "border-silver/40 bg-silver/10 text-silver-2";
    case "cancelada":
      return "border-white/10 bg-white/5 text-muted";
    default:
      return "border-white/10 bg-transparent text-muted";
  }
}

/** Resumo curto do jsonb resultado — nunca JSON cru na cara do usuário. */
function resumirResultado(etapa: EtapaExecucaoView): string | null {
  const resultado = etapa.resultado;
  if (!resultado || typeof resultado !== "object") return null;

  if (typeof resultado.erro === "string") return resultado.erro;

  switch (etapa.tipo_acao as TipoAcaoWorkflow) {
    case "criar_tarefa":
      return typeof resultado.tarefa_id === "string" ? "Tarefa criada na checklist do caso." : null;
    case "criar_prazo":
      if (typeof resultado.data_prazo === "string") {
        const dataBr = resultado.data_prazo.split("-").reverse().join("/");
        return `Prazo criado para ${dataBr}.`;
      }
      return typeof resultado.prazo_id === "string" ? "Prazo criado." : null;
    case "gerar_documento": {
      if (typeof resultado.documento_gerado_id !== "string") return null;
      const naoResolvidas = Array.isArray(resultado.variaveis_nao_resolvidas)
        ? (resultado.variaveis_nao_resolvidas as unknown[]).filter((v): v is string => typeof v === "string")
        : [];
      return naoResolvidas.length > 0
        ? `Documento gerado — confira: ${naoResolvidas.length} variável(is) não resolvida(s).`
        : "Documento gerado e registrado em Documentos.";
    }
    case "mensagem_portal": {
      const enviadas = typeof resultado.mensagens_enviadas === "number" ? resultado.mensagens_enviadas : 0;
      return enviadas > 0 ? `Mensagem enviada a ${enviadas} cliente(s) do portal.` : null;
    }
    default:
      return null;
  }
}

const dataHoraBr = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

export function WorkflowExecucoes({ execucoes }: { execucoes: ExecucaoView[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [execucoesFechadas, setExecucoesFechadas] = useState<Set<string>>(new Set());

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

  if (execucoes.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-white/10 px-3 py-6 text-center text-xs text-muted">
        Nenhuma execução ainda. Use “Executar” num workflow acima para rodá-lo sobre um caso.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {erro && (
        <p className="rounded-md border border-red-500/30 bg-red-950/30 px-3 py-2 text-xs text-red-300">{erro}</p>
      )}

      {execucoes.map((execucao) => {
        const aberta = !execucoesFechadas.has(execucao.id);
        const progresso = resumoProgresso(
          execucao.etapas.map((etapaAtual) => ({
            ordem: etapaAtual.ordem,
            // Cast defensivo: status vem do banco dentro do check constraint.
            status: etapaAtual.status as StatusEtapaExecucao,
          })),
        );
        const emAndamento = execucao.status === "em_andamento";

        return (
          <div key={execucao.id} className="rounded-xl border border-white/10 bg-navy-2/60">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-white/10 px-4 py-3">
              <button
                type="button"
                onClick={() =>
                  setExecucoesFechadas((atuais) => {
                    const proximo = new Set(atuais);
                    if (proximo.has(execucao.id)) proximo.delete(execucao.id);
                    else proximo.add(execucao.id);
                    return proximo;
                  })
                }
                className="text-left"
                aria-expanded={aberta}
              >
                <p className="font-display text-sm font-semibold text-ice hover:text-silver-2">
                  {aberta ? "▾" : "▸"} {execucao.workflow_nome}
                </p>
              </button>
              <span className="text-xs text-muted">
                {execucao.nome_cliente ?? "(sem nome)"} · iniciada em {dataHoraBr(execucao.criado_em)}
              </span>

              <span
                className={`ml-auto rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                  execucao.status === "concluida"
                    ? corStatus("concluida")
                    : execucao.status === "cancelada"
                      ? corStatus("cancelada")
                      : corStatus("aguardando_humano")
                }`}
              >
                {execucao.status === "concluida" ? "Concluída" : execucao.status === "cancelada" ? "Cancelada" : "Em andamento"}
              </span>

              <span className="text-xs text-muted">
                {progresso.concluidas}/{progresso.total} etapas
              </span>

              {emAndamento && (
                <Button
                  variant="danger"
                  size="sm"
                  disabled={pending}
                  onClick={() => rodar(() => cancelarExecucaoAction(execucao.id))}
                >
                  Cancelar
                </Button>
              )}
            </div>

            {aberta && (
              <ol className="space-y-2 px-4 py-3">
                {execucao.etapas.map((etapaAtual) => {
                  const status = etapaAtual.status as StatusEtapaExecucao;
                  const resumo = resumirResultado(etapaAtual);
                  return (
                    <li key={etapaAtual.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="w-5 text-right text-xs text-muted">{etapaAtual.ordem}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${corStatus(status)}`}>
                        {STATUS_ETIQUETA[status] ?? status}
                      </span>
                      <span className={status === "pendente" ? "text-muted" : "text-ice"}>
                        {ROTULO_ACAO[etapaAtual.tipo_acao as TipoAcaoWorkflow] ?? etapaAtual.tipo_acao}:{" "}
                        {etapaAtual.titulo}
                      </span>
                      {resumo && <span className="text-xs text-muted">— {resumo}</span>}

                      <div className="ml-auto flex items-center gap-2">
                        {status === "aguardando_humano" && (
                          <Button
                            size="sm"
                            disabled={pending}
                            onClick={() => rodar(() => concluirEtapaHumanaAction(etapaAtual.id))}
                          >
                            Concluir aprovação
                          </Button>
                        )}
                        {status === "falha" && (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={pending}
                            onClick={() => rodar(() => reprocessarEtapaAction(etapaAtual.id))}
                          >
                            Tentar novamente
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        );
      })}
    </div>
  );
}
