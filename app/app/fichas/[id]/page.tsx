import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GerarAnaliseButton } from "@/components/app/gerar-analise-button";
import { GerarRiscoButton } from "@/components/app/gerar-risco-button";
import { FichaLidaToggle } from "@/components/app/ficha-lida-toggle";
import { StatusProcessualSelect } from "@/components/app/status-processual-select";
import { ExcluirFichaButton } from "@/components/app/excluir-ficha-button";
import { MarkdownLite } from "@/components/app/markdown-lite";
import { PortalClienteCard } from "@/components/app/portal-cliente-card";
import { GerarPeticaoCard, type ModeloParaSelecao } from "@/components/app/gerar-peticao-card";
import { RedacaoAssistidaCard } from "@/components/app/redacao-assistida-card";
import { planoTemAcesso } from "@/lib/planos/gating";
import type { ClientePortal, FichaCaso } from "@/lib/types";

const URGENCIA_TONE = {
  alta: "red",
  normal: "silver",
  baixa: "muted",
} as const;

const RISCO_TONE = {
  alto: "red",
  medio: "silver",
  baixo: "green",
} as const;

const RISCO_LABEL = {
  alto: "Alto",
  medio: "Médio",
  baixo: "Baixo",
} as const;

const STATUS_PROCESSUAL_TONE = {
  em_andamento: "silver",
  ganho: "green",
  acordo: "green",
  perdido: "red",
  arquivado: "muted",
} as const;

const STATUS_PROCESSUAL_LABEL = {
  em_andamento: "Em andamento",
  ganho: "Ganho",
  acordo: "Acordo homologado",
  perdido: "Perdido",
  arquivado: "Arquivado",
} as const;

export default async function FichaDetalhePage({ params }: PageProps<"/app/fichas/[id]">) {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  const { id } = await params;
  const supabase = await createClient();
  const { data: ficha } = await supabase
    .from("fichas_caso")
    .select("*")
    .eq("id", id)
    .maybeSingle<FichaCaso>();

  if (!ficha) notFound();

  const { data: clientePortal } = await supabase
    .from("clientes_portal")
    .select("*")
    .eq("ficha_caso_id", ficha.id)
    .maybeSingle<ClientePortal>();

  const { data: modelosDisponiveis } = await supabase
    .from("modelos")
    .select("id, nome, tipo")
    .order("nome", { ascending: true })
    .returns<ModeloParaSelecao[]>();

  const temAnalise = Boolean(ficha.resumo_ia || ficha.questoes_ia || ficha.estrategia_ia);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/app/fichas" className="text-xs font-medium text-silver hover:text-silver-2">
          ← Voltar para fichas
        </Link>
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ice">
              {ficha.nome_cliente ?? "Cliente sem nome"}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {ficha.area_direito ?? "Área não informada"}
              {ficha.telefone ? ` · ${ficha.telefone}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={URGENCIA_TONE[ficha.urgencia]}>Urgência {ficha.urgencia}</Badge>
            {ficha.nivel_risco && (
              <Badge tone={RISCO_TONE[ficha.nivel_risco]}>Risco {RISCO_LABEL[ficha.nivel_risco]}</Badge>
            )}
            <Badge tone={STATUS_PROCESSUAL_TONE[ficha.status_processual]}>
              {STATUS_PROCESSUAL_LABEL[ficha.status_processual]}
            </Badge>
            {!ficha.lida && <Badge tone="blue">Não lida</Badge>}
          </div>
        </div>

        <div className="mb-4">
          <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Resumo dos fatos</h2>
          <p className="whitespace-pre-wrap text-sm text-ice-2">{ficha.resumo_fatos}</p>
        </div>

        <div className="mb-4">
          <StatusProcessualSelect fichaId={ficha.id} statusProcessual={ficha.status_processual} />
        </div>

        <div className="flex flex-wrap gap-3">
          <FichaLidaToggle fichaId={ficha.id} lida={ficha.lida} />
          <ExcluirFichaButton fichaId={ficha.id} />
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <CardTitle>Análise com IA</CardTitle>
          <GerarAnaliseButton fichaId={ficha.id} jaTemAnalise={temAnalise} />
        </div>

        {!temAnalise ? (
          <p className="text-sm text-muted">
            Nenhuma análise gerada ainda. Clique em &quot;Gerar análise com IA&quot; para que o copiloto jurídico
            produza um resumo, as questões jurídicas e a estratégia recomendada.
          </p>
        ) : (
          <div className="space-y-5">
            {ficha.resumo_ia && (
              <div>
                <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Resumo</h3>
                <MarkdownLite texto={ficha.resumo_ia} />
              </div>
            )}
            {ficha.questoes_ia && (
              <div>
                <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">
                  Questões jurídicas
                </h3>
                <MarkdownLite texto={ficha.questoes_ia} />
              </div>
            )}
            {ficha.estrategia_ia && (
              <div>
                <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">
                  Estratégia recomendada
                </h3>
                <MarkdownLite texto={ficha.estrategia_ia} />
              </div>
            )}
          </div>
        )}
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <CardTitle>Score de risco do caso</CardTitle>
          <GerarRiscoButton fichaId={ficha.id} jaTemRisco={Boolean(ficha.nivel_risco)} />
        </div>

        {!ficha.nivel_risco ? (
          <p className="text-sm text-muted">
            Nenhum score calculado ainda. Clique em &quot;Calcular risco do caso&quot; para que a IA avalie o nível
            de risco com base nos dados já registrados na ficha.
          </p>
        ) : (
          <div className="flex items-center gap-3">
            <Badge tone={RISCO_TONE[ficha.nivel_risco]}>Risco {RISCO_LABEL[ficha.nivel_risco]}</Badge>
            {ficha.risco_calculado_em && (
              <span className="text-xs text-muted">
                Calculado em {new Date(ficha.risco_calculado_em).toLocaleDateString("pt-BR")}
              </span>
            )}
          </div>
        )}
      </Card>

      <GerarPeticaoCard fichaId={ficha.id} modelos={modelosDisponiveis ?? []} />

      <RedacaoAssistidaCard
        fichaId={ficha.id}
        temAcesso={planoTemAcesso(usuario.perfil.escritorio, "redacao_assistida_pecas")}
      />

      <Card>
        <CardTitle className="mb-4">Portal do cliente</CardTitle>
        <PortalClienteCard fichaId={ficha.id} clientePortal={clientePortal ?? null} />
      </Card>
    </div>
  );
}
