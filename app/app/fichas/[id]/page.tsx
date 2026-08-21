import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { GerarAnaliseButton } from "@/components/app/gerar-analise-button";
import { GerarRiscoButton } from "@/components/app/gerar-risco-button";
import { FichaLidaToggle } from "@/components/app/ficha-lida-toggle";
import { StatusProcessualSelect } from "@/components/app/status-processual-select";
import { ExcluirFichaButton } from "@/components/app/excluir-ficha-button";
import { MarkdownLite } from "@/components/app/markdown-lite";
import { PortalClienteCard } from "@/components/app/portal-cliente-card";
import { GerarPeticaoCard, type ModeloParaSelecao } from "@/components/app/gerar-peticao-card";
import { RedacaoAssistidaCard } from "@/components/app/redacao-assistida-card";
import { AutomacaoCondicionalCard } from "@/components/app/automacao-condicional-card";
import { listarModelosCondicionaisAction } from "./mail-merge-condicional-actions";
import { ChatClienteCard } from "@/components/app/chat-cliente-card";
import { planoTemAcesso } from "@/lib/planos/gating";
import { listarPessoasCasoAction } from "./pessoas-actions";
import { listarTarefasCasoAction } from "./tarefas-actions";
import { listarEventosCasoAction } from "@/lib/casos/timeline";
import { listarTesesCasoAction } from "../actions";
import { listarAnalisesProcessoAction } from "./analise-processo-actions";
import { PessoasCasoSection } from "./pessoas-caso-section";
import { TarefasCasoSection } from "./tarefas-caso-section";
import { TimelineCasoList } from "./timeline-caso-list";
import { TesesCasoSection } from "./teses-caso-section";
import { AnaliseProcessoSection } from "./analise-processo-section";
import type { ClientePortal, FichaCaso, MensagemPortalCliente } from "@/lib/types";

/**
 * Análise inteligente de processo (ADR 0004) roda de forma síncrona dentro
 * da própria Server Action, chamada pelo formulário de upload desta página —
 * mesmo mecanismo de `app/api/cron/sincronizar-djen/route.ts` (`maxDuration =
 * 60`), com teto maior (120s) porque a chamada de IA aqui processa um
 * documento inteiro em uma única chamada (sem chunking/fila — ver ADR seção
 * 6).
 */
export const maxDuration = 120;

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

  const modelosCondicionais = await listarModelosCondicionaisAction();

  const { data: membrosEquipeData } = await supabase
    .from("perfis")
    .select("id, nome")
    .order("nome", { ascending: true })
    .returns<{ id: string; nome: string }[]>();
  const membrosEquipe = membrosEquipeData ?? [];

  // As 4 seções abaixo ("Caso Inteligente" Fase 1) dependem das migrations
  // 0022-0029, que podem ainda não ter sido rodadas no banco em uso — cada
  // action já trata erro de query explicitamente ({ ok: false, error }), então
  // aqui só reduzimos para listas vazias em caso de falha, sem derrubar a
  // página nem propagar o erro para a UI (estado esperado até as migrations
  // rodarem).
  const [pessoasResultado, eventosResultado, tesesResultado, tarefasResultado, analisesProcessoResultado] =
    await Promise.all([
      listarPessoasCasoAction(ficha.id),
      listarEventosCasoAction(ficha.id),
      listarTesesCasoAction(ficha.id),
      listarTarefasCasoAction(ficha.id),
      listarAnalisesProcessoAction(ficha.id),
    ]);
  const pessoas = pessoasResultado.ok ? pessoasResultado.pessoas : [];
  const eventos = eventosResultado.ok ? eventosResultado.eventos : [];
  const teses = tesesResultado.ok ? tesesResultado.teses : [];
  const tarefas = tarefasResultado.ok ? tarefasResultado.tarefas : [];
  const analisesProcesso = analisesProcessoResultado.ok ? analisesProcessoResultado.analises : [];

  const temAcessoChat = planoTemAcesso(usuario.perfil.escritorio, "portal_cliente_rico");
  const clientePortalAtivo = clientePortal?.auth_user_id ? clientePortal : null;

  // Só busca o histórico quando há cliente ativo E a feature está
  // liberada — sem cliente ativo não há com quem conversar, e sem a
  // feature o card mostra upsell no lugar (sem custo de rede).
  const { data: mensagensChat } =
    clientePortalAtivo && temAcessoChat
      ? await supabase
          .from("mensagens_portal_cliente")
          .select("*")
          .eq("cliente_portal_id", clientePortalAtivo.id)
          .order("criado_em", { ascending: true })
          .returns<MensagemPortalCliente[]>()
      : { data: null as MensagemPortalCliente[] | null };

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
          <LinkButton href={`/app/documentos/novo?fichaId=${ficha.id}`} variant="secondary" size="sm">
            Analisar documento
          </LinkButton>
          <ExcluirFichaButton fichaId={ficha.id} />
        </div>
      </Card>

      <Tabs
        items={[
          {
            id: "visao-geral",
            label: "Visão Geral",
            content: (
              <div className="space-y-6">
                <Card>
                  <div className="mb-4 flex items-center justify-between">
                    <CardTitle>Análise com IA</CardTitle>
                    <GerarAnaliseButton fichaId={ficha.id} jaTemAnalise={temAnalise} />
                  </div>

                  {!temAnalise ? (
                    <p className="text-sm text-muted">
                      Nenhuma análise gerada ainda. Clique em &quot;Gerar análise com IA&quot; para que o copiloto
                      jurídico produza um resumo, as questões jurídicas e a estratégia recomendada.
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
                      Nenhum score calculado ainda. Clique em &quot;Calcular risco do caso&quot; para que a IA
                      avalie o nível de risco com base nos dados já registrados na ficha.
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

                <AutomacaoCondicionalCard
                  fichaId={ficha.id}
                  modelos={modelosCondicionais}
                  temAcesso={planoTemAcesso(usuario.perfil.escritorio, "automacao_documento_condicional")}
                />

                <Card>
                  <CardTitle className="mb-4">Portal do cliente</CardTitle>
                  <PortalClienteCard fichaId={ficha.id} clientePortal={clientePortal ?? null} />
                </Card>

                {clientePortalAtivo && (
                  <Card>
                    <CardTitle className="mb-4">Chat com o cliente</CardTitle>
                    {temAcessoChat ? (
                      <ChatClienteCard
                        fichaId={ficha.id}
                        clientePortalId={clientePortalAtivo.id}
                        clienteNome={clientePortalAtivo.nome}
                        mensagensIniciais={mensagensChat ?? []}
                      />
                    ) : (
                      <p className="text-sm text-muted">
                        Chat bidirecional em tempo real com o cliente é uma feature do{" "}
                        <span className="font-medium text-ice">Plano Pro</span>. Assine em{" "}
                        <Link href="/app/perfil" className="text-ice underline underline-offset-2">
                          Meu perfil
                        </Link>{" "}
                        para liberar — as mensagens trocadas antes de um eventual downgrade não são perdidas, só
                        ficam indisponíveis nesta tela enquanto o plano estiver no Free.
                      </p>
                    )}
                  </Card>
                )}
              </div>
            ),
          },
          {
            id: "pessoas",
            label: "Pessoas",
            contador: pessoas.length,
            content: (
              <Card>
                <PessoasCasoSection fichaCasoId={ficha.id} pessoasIniciais={pessoas} />
              </Card>
            ),
          },
          {
            id: "linha-do-tempo",
            label: "Linha do Tempo",
            contador: eventos.length,
            content: (
              <Card>
                <CardTitle className="mb-4">Linha do tempo do caso</CardTitle>
                <TimelineCasoList eventos={eventos} />
              </Card>
            ),
          },
          {
            id: "tarefas",
            label: "Tarefas",
            contador: tarefas.length,
            content: (
              <Card>
                <TarefasCasoSection fichaCasoId={ficha.id} tarefasIniciais={tarefas} membrosEquipe={membrosEquipe} />
              </Card>
            ),
          },
          {
            id: "teses",
            label: "Teses",
            contador: teses.length,
            content: (
              <Card>
                <TesesCasoSection tesesIniciais={teses} />
              </Card>
            ),
          },
          {
            id: "analise-processo",
            label: "Análise de Processo",
            contador: analisesProcesso.length,
            content: (
              <Card>
                <CardTitle className="mb-4">Análise inteligente de processo</CardTitle>
                <AnaliseProcessoSection
                  fichaCasoId={ficha.id}
                  analisesIniciais={analisesProcesso}
                  temAcesso={planoTemAcesso(usuario.perfil.escritorio, "analise_inteligente_processo")}
                />
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}
