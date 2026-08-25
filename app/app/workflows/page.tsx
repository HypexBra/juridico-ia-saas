import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { planoTemAcesso } from "@/lib/planos/gating";
import { Card, CardTitle } from "@/components/ui/card";
import {
  WorkflowsPainel,
  type EtapaDefinicaoView,
  type FichaOpcao,
  type WorkflowListaItem,
} from "@/components/app/workflow-painel";
import type { ExecucaoView, EtapaExecucaoView } from "@/components/app/workflow-execucoes";

export const metadata = { title: "Workflows — Jurídico IA" };

/**
 * FASE 8 — Workflow Engine (feature Pro "workflows_automacao", ADR
 * docs/adrs/0016-workflow-engine.md). Página inteira gated (mesmo padrão do
 * Redline): não existe variante free de automação de rotinas. O server
 * component só busca dados (RLS isola o escritório) e hidrata o painel
 * client — toda interatividade vive em components/app/workflow-*.
 */
export default async function WorkflowsPage() {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  const temAcesso = planoTemAcesso(usuario.perfil.escritorio, "workflows_automacao");

  if (!temAcesso) {
    // Upsell idêntico ao padrão do Redline: card único apontando para /app/perfil.
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ice">Workflows — Automação de rotinas</h1>
          <p className="mt-1 text-sm text-muted">
            Sequências de etapas (tarefas, prazos, documentos, mensagens e aprovações) executadas sobre cada caso em
            um clique.
          </p>
        </div>
        <Card>
          <CardTitle className="mb-1">Automação de workflows</CardTitle>
          <p className="text-sm text-muted">
            Criar e executar workflows automáticos é uma feature do <span className="font-medium text-ice">Plano Pro</span>.
            Assine em{" "}
            <a href="/app/perfil" className="text-ice underline underline-offset-2">
              Meu perfil
            </a>{" "}
            para liberar.
          </p>
        </Card>
      </div>
    );
  }

  const supabase = await createClient();

  // ── Buscas paralelas (todas filtradas por RLS do escritório) ────────────

  const [{ data: workflowsData }, { data: definicoesData }, { data: execucoesData }, { data: fichasData }, { data: modelosData }] =
    await Promise.all([
      supabase
        .from("workflows")
        .select("id, nome, descricao, ativo, criado_em")
        .order("criado_em", { ascending: false })
        .returns<Array<{ id: string; nome: string; descricao: string | null; ativo: boolean; criado_em: string }>>(),
      supabase
        .from("workflow_etapas")
        .select("workflow_id, ordem, tipo_acao, titulo, configuracao")
        .order("ordem", { ascending: true })
        .returns<Array<{ workflow_id: string; ordem: number; tipo_acao: string; titulo: string; configuracao: Record<string, unknown> }>>(),
      supabase
        .from("workflow_execucoes")
        .select("id, workflow_nome, ficha_caso_id, status, criado_em")
        .order("criado_em", { ascending: false })
        .limit(15)
        .returns<Array<{ id: string; workflow_nome: string; ficha_caso_id: string; status: string; criado_em: string }>>(),
      supabase
        .from("fichas_caso")
        .select("id, nome_cliente, area_direito")
        .is("deletado_em", null)
        .order("criado_em", { ascending: false })
        .limit(50)
        .returns<FichaOpcao[]>(),
      supabase.from("modelos").select("id, nome").order("nome", { ascending: true }).returns<Array<{ id: string; nome: string }>>(),
    ]);

  const execucoes = execucoesData ?? [];

  // Etapas INSTANCIADAS das execuções listadas (stepper visual).
  const execucaoIds = execucoes.map((execucao) => execucao.id);
  let etapasPorExecucao: Record<string, EtapaExecucaoView[]> = {};
  if (execucaoIds.length > 0) {
    const { data: etapasInstanciadas } = await supabase
      .from("workflow_execucao_etapas")
      .select("id, execucao_id, ordem, tipo_acao, titulo, status, resultado")
      .in("execucao_id", execucaoIds)
      .order("ordem", { ascending: true })
      .returns<EtapaExecucaoView[]>();
    etapasPorExecucao = (etapasInstanciadas ?? []).reduce<Record<string, EtapaExecucaoView[]>>(
      (mapa, etapaAtual) => {
        const lista = mapa[etapaAtual.execucao_id] ?? [];
        lista.push(etapaAtual);
        mapa[etapaAtual.execucao_id] = lista;
        return mapa;
      },
      {},
    );
  }

  // Nome do cliente por ficha (join manual leve — evita select aninhado).
  const nomesPorFicha = new Map((fichasData ?? []).map((ficha) => [ficha.id, ficha.nome_cliente]));
  const execucoesView: ExecucaoView[] = execucoes.map((execucao) => ({
    id: execucao.id,
    workflow_nome: execucao.workflow_nome,
    ficha_caso_id: execucao.ficha_caso_id,
    nome_cliente: nomesPorFicha.get(execucao.ficha_caso_id) ?? null,
    status: execucao.status,
    criado_em: execucao.criado_em,
    etapas: etapasPorExecucao[execucao.id] ?? [],
  }));

  // Agrupa as DEFINIÇÕES de etapas por workflow para leitura/edição.
  const etapasPorWorkflow: Record<string, EtapaDefinicaoView[]> = {};
  for (const etapaAtual of definicoesData ?? []) {
    const lista = etapasPorWorkflow[etapaAtual.workflow_id] ?? [];
    lista.push({ ordem: etapaAtual.ordem, tipo_acao: etapaAtual.tipo_acao, titulo: etapaAtual.titulo, configuracao: etapaAtual.configuracao });
    etapasPorWorkflow[etapaAtual.workflow_id] = lista;
  }

  const workflowsLista: WorkflowListaItem[] = (workflowsData ?? []).map((workflow) => ({
    id: workflow.id,
    nome: workflow.nome,
    descricao: workflow.descricao,
    ativo: workflow.ativo,
    criado_em: workflow.criado_em,
    etapas: etapasPorWorkflow[workflow.id] ?? [],
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ice">Workflows — Automação de rotinas</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Monte uma sequência de etapas uma vez (tarefas, prazos, documentos, mensagens ao cliente e aprovações
          humanas) e dispare sobre qualquer caso. A cadeia roda sozinha e PAUSA nas aprovações humanas — revise antes
          de concluir cada etapa.
        </p>
      </div>

      <WorkflowsPainel
        workflows={workflowsLista}
        etapasPorWorkflow={etapasPorWorkflow}
        execucoes={execucoesView}
        fichas={fichasData ?? []}
        modelos={modelosData ?? []}
      />
    </div>
  );
}
