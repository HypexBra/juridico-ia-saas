import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { sincronizarParcelasAtrasadas } from "@/app/app/financeiro/actions";
import { calcularResumoFinanceiro, type ParcelaResumoInput } from "@/lib/financeiro/resumo";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { BorderGlow } from "@/components/ui/border-glow/border-glow";
import { DonutChart } from "@/components/app/charts/donut-chart";
import { UsageRing } from "@/components/app/charts/usage-ring";
import { PropostaAcaoCard } from "@/components/app/proposta-acao-card";
import { TarefaDashboardItem } from "@/components/app/tarefa-dashboard-item";
import { RadarHoje } from "@/components/app/radar-hoje";
import { coletarSinaisRadar, classificarSinais } from "@/lib/radar/radar";
import { compararTarefasPorUrgencia } from "@/lib/casos/tarefas";
import { limiteMensagensIaPara } from "@/lib/types";
import type { FichaCaso, Prazo, TarefaCaso } from "@/lib/types";

/** Quantas propostas pendentes renderizar direto no dashboard antes de "e mais N". */
const LIMITE_PROPOSTAS_INBOX = 5;

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export const metadata = { title: "Dashboard — Jurídico IA" };

function formatarData(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function diasAte(iso: string) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(`${iso}T00:00:00`);
  return Math.ceil((alvo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

function urgenciaPrazo(dias: number): { label: string; tone: "red" | "silver" | "green" | "muted" } {
  if (dias < 0) return { label: "Vencido", tone: "red" };
  if (dias <= 1) return { label: "Urgente", tone: "red" };
  if (dias <= 3) return { label: `Em ${dias} dias`, tone: "silver" };
  if (dias <= 7) return { label: `Em ${dias} dias`, tone: "silver" };
  return { label: `Em ${dias} dias`, tone: "green" };
}

export default async function DashboardPage() {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  const supabase = await createClient();
  const mesRef = new Date().toISOString().slice(0, 7);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const limiteAlerta = new Date(hoje);
  limiteAlerta.setDate(limiteAlerta.getDate() + 3);
  const dataLimiteAlerta = limiteAlerta.toISOString().slice(0, 10);

  // Recalcula pendente -> atrasado antes de agregar o card financeiro (mesma
  // garantia usada em app/app/financeiro/page.tsx antes de qualquer leitura).
  // Radar Jurídico (Fase 10/11): sinais determinísticos coletados na mesma
  // rodada de carregamento — a seção "O que preciso saber hoje" nunca espera
  // rede extra nem depende de IA para existir.
  const [sinaisRadar] = await Promise.all([
    coletarSinaisRadar(supabase),
    sincronizarParcelasAtrasadas(usuario.perfil.escritorio_id).then(() => undefined as void),
  ]);

  const [
    prazosRes,
    alertasPrazoRes,
    fichasRes,
    usoRes,
    todosPrazosRes,
    propostasPendentesRes,
    totalPropostasPendentesRes,
    parcelasRes,
    tarefasRes,
  ] = await Promise.all([
    supabase
      .from("prazos")
      .select("*")
      .eq("concluido", false)
      .order("data_prazo", { ascending: true })
      .limit(6)
      .returns<Prazo[]>(),
    // Alertas: só leitura, prazos vencidos ou que vencem nos próximos 3 dias
    // — ordenado por urgência (mais vencido/mais próximo primeiro).
    supabase
      .from("prazos")
      .select("*")
      .eq("concluido", false)
      .lte("data_prazo", dataLimiteAlerta)
      .order("data_prazo", { ascending: true })
      .limit(10)
      .returns<Prazo[]>(),
    supabase
      .from("fichas_caso")
      .select("*")
      .eq("lida", false)
      .order("criado_em", { ascending: false })
      .limit(6)
      .returns<FichaCaso[]>(),
    supabase.from("uso_ia").select("id").eq("mes_ref", mesRef),
    // Distribuição de todos os prazos em aberto por faixa de urgência —
    // alimenta o donut do dashboard mobile (leitura à parte da lista curta
    // acima, que só traz os 6 mais próximos).
    supabase.from("prazos").select("data_prazo").eq("concluido", false).returns<{ data_prazo: string }[]>(),
    // Inbox de propostas pendentes (ex: prazos sugeridos pela sincronização
    // do DJEN) — mais antigas primeiro, pra não deixar nada vencer os 24h de
    // expiração sem o advogado ver. Aprovar/rejeitar reusa exatamente o mesmo
    // fluxo do chat (PropostaAcaoCard + propostas-actions.ts).
    supabase
      .from("propostas_acao")
      .select("id")
      .eq("status", "pending")
      .order("criado_em", { ascending: true })
      .limit(LIMITE_PROPOSTAS_INBOX)
      .returns<{ id: string }[]>(),
    // Contador total (independente do limite acima) pro badge do topo.
    supabase.from("propostas_acao").select("id", { count: "exact", head: true }).eq("status", "pending"),
    // Parcelas de honorário do escritório — mesma fonte de dados usada em
    // app/app/financeiro/page.tsx, agregada por lib/financeiro/resumo.ts pra
    // não duplicar a lógica de soma por mês/status.
    supabase
      .from("parcelas_honorario")
      .select("valor, vencimento, status, pago_em")
      .returns<ParcelaResumoInput[]>(),
    // Tarefas internas do caso (Fase 1 — distinto de `prazos`, que é
    // processual). Fase 19 do roadmap: dashboard mostrava só prazos, nunca
    // tarefas — advogado tinha que abrir cada ficha pra ver o checklist.
    // Sem responsável definido entra pra todo mundo ver (equipe pequena);
    // com responsável, só aparece pra quem foi atribuído — evita lista
    // lotada de tarefas de colegas.
    supabase
      .from("tarefas_caso")
      .select("*")
      .neq("status", "concluida")
      .or(`responsavel_perfil_id.is.null,responsavel_perfil_id.eq.${usuario.perfil.id}`)
      .order("prazo_opcional", { ascending: true, nullsFirst: false })
      .limit(6)
      .returns<TarefaCaso[]>(),
  ]);

  const prazos = prazosRes.data ?? [];
  const alertasPrazo = alertasPrazoRes.data ?? [];
  const fichas = fichasRes.data ?? [];
  const usoMes = usoRes.data?.length ?? 0;
// BUG do círculo "/25": o denominador era sempre LIMITE_MENSAGENS_FREE (25),
  // mesmo para escritório Pro (limite 300) — um Pro com 25 usos aparecia com
  // anel em 100% cheio. Agora usa o limite REAL do plano do escritório.
  const limiteIaEscritorio = limiteMensagensIaPara(usuario.perfil.escritorio.plano);
  const percentualUso = Math.min(100, Math.round((usoMes / limiteIaEscritorio) * 100));

  const propostasPendentes = propostasPendentesRes.data ?? [];
  const totalPropostasPendentes = totalPropostasPendentesRes.count ?? propostasPendentes.length;
  const propostasExtras = Math.max(0, totalPropostasPendentes - propostasPendentes.length);

  const resumoFinanceiro = calcularResumoFinanceiro(parcelasRes.data ?? [], mesRef);
  const tarefas = [...(tarefasRes.data ?? [])].sort((a, b) => compararTarefasPorUrgencia(a, b));

  const distribuicaoPrazos = { vencidos: 0, urgentes: 0, semana: 0, futuros: 0 };
  for (const prazo of todosPrazosRes.data ?? []) {
    const dias = diasAte(prazo.data_prazo);
    if (dias < 0) distribuicaoPrazos.vencidos += 1;
    else if (dias <= 1) distribuicaoPrazos.urgentes += 1;
    else if (dias <= 7) distribuicaoPrazos.semana += 1;
    else distribuicaoPrazos.futuros += 1;
  }
  // Paleta clara legível (papel-e-tinta): vermelho/âmbar AA para atraso,
  // tinta para janela próxima e verde para o futuro tranquilo.
  const segmentosPrazos = [
    { label: "Vencidos", value: distribuicaoPrazos.vencidos, color: "#b91c1c" },
    { label: "Urgentes (≤1 dia)", value: distribuicaoPrazos.urgentes, color: "#b45309" },
    { label: "Esta semana", value: distribuicaoPrazos.semana, color: "#44423b" },
    { label: "Futuros", value: distribuicaoPrazos.futuros, color: "#15803d" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ice">
          Olá, {usuario.perfil.nome.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted">Visão geral do escritório {usuario.perfil.escritorio.nome}.</p>
      </div>

      <RadarHoje sinaisIniciais={classificarSinais(sinaisRadar)} />

      {alertasPrazo.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-red-700" />
              <CardTitle className="text-ice">Prazos que exigem atenção</CardTitle>
            </div>
            <LinkButton href="/app/prazos" variant="ghost" size="sm">
              Ver todos →
            </LinkButton>
          </div>
          <ul className="space-y-2.5">
            {alertasPrazo.map((prazo) => {
              const dias = diasAte(prazo.data_prazo);
              const urgencia = urgenciaPrazo(dias);
              return (
                <li
                  key={prazo.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-ink/10 bg-navy-3/40 px-3 py-2.5 transition-transform duration-150 ease-out active:scale-[0.98] active:bg-navy-3/70"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ice">{prazo.titulo}</p>
                    <p className="text-xs text-muted">
                      {formatarData(prazo.data_prazo)}
                      {prazo.cliente_nome ? ` · ${prazo.cliente_nome}` : ""}
                      {prazo.processo ? ` · ${prazo.processo}` : ""}
                    </p>
                  </div>
                  <Badge tone={urgencia.tone}>{urgencia.label}</Badge>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {propostasPendentes.length > 0 && (
        <Card id="propostas-djen" className="border-silver/25 bg-navy-3/30">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-ice">Propostas pendentes de aprovação</CardTitle>
              <Badge tone="silver">{totalPropostasPendentes}</Badge>
            </div>
          </div>
          <p className="mb-1 text-xs text-muted">
            Sugestões automáticas (ex.: prazos importados do DJEN) esperando sua revisão antes de entrar no sistema.
          </p>
          <div className="mt-3 space-y-2">
            {propostasPendentes.map((proposta) => (
              <PropostaAcaoCard key={proposta.id} propostaId={proposta.id} />
            ))}
          </div>
          {propostasExtras > 0 && (
            <p className="mt-3 text-xs text-muted">
              +{propostasExtras} proposta(s) adicional(is) aguardando — aprove ou rejeite as de cima para ver as próximas.
            </p>
          )}
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/app/prazos"
          className="block rounded-xl transition-transform duration-150 ease-out active:scale-[0.97]"
        >
          <Card className="h-full">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Prazos em aberto</p>
            <p className="mt-2 font-display text-3xl font-bold text-ice">{prazos.length}</p>
            <span className="mt-3 inline-block text-xs font-medium text-silver">Ver todos →</span>
          </Card>
        </Link>
        <Link
          href="/app/fichas"
          className="block rounded-xl transition-transform duration-150 ease-out active:scale-[0.97]"
        >
          <Card className="h-full">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Fichas não lidas</p>
            <p className="mt-2 font-display text-3xl font-bold text-ice">{fichas.length}</p>
            <span className="mt-3 inline-block text-xs font-medium text-silver">Ver todas →</span>
          </Card>
        </Link>
        <Link
          href={totalPropostasPendentes > 0 ? "#propostas-djen" : "/app/prazos"}
          className="block rounded-xl transition-transform duration-150 ease-out active:scale-[0.97]"
        >
          <Card className={`h-full ${totalPropostasPendentes > 0 ? "border-silver/30" : ""}`}>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Propostas do DJEN</p>
            <p className="mt-2 font-display text-3xl font-bold text-ice">{totalPropostasPendentes}</p>
            <span className="mt-3 inline-block text-xs font-medium text-silver">
              {totalPropostasPendentes > 0 ? "Revisar agora →" : "Nenhuma pendente"}
            </span>
          </Card>
        </Link>

        {/* Glow suave em papel: fundo claro, lavagem verde-selo e halo dourado
            de baixa intensidade — o glow forte era artefato do tema escuro. */}
        <BorderGlow
          className="h-full"
          glowColor="42 75 70"
          backgroundColor="#f3f1ea"
          borderRadius={12}
          glowRadius={26}
          glowIntensity={0.5}
          colors={["#e8efe9", "#2f6f59", "#f3f1ea"]}
        >
          <div className="flex h-full items-center gap-4 p-5">
            <UsageRing percent={percentualUso} label="Uso de IA no mês" tone={percentualUso >= 90 ? "red" : "silver"} size={72} strokeWidth={7} />
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Uso de IA no mês</p>
              <p className="mt-1 font-display text-lg font-bold text-ice">
                {usoMes}
                <span className="text-sm font-normal text-muted"> / {limiteIaEscritorio}</span>
              </p>
            </div>
          </div>
        </BorderGlow>
      </div>

      <Card>
        <CardTitle className="mb-4">Prazos por urgência</CardTitle>
        <DonutChart segments={segmentosPrazos} />
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <CardTitle>Financeiro</CardTitle>
          <LinkButton href="/app/financeiro" variant="ghost" size="sm">
            Ver financeiro →
          </LinkButton>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Recebido no mês</p>
            <p className="mt-2 font-display text-2xl font-bold text-ice">
              {formatarMoeda(resumoFinanceiro.recebidoNoMes)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">A receber no mês</p>
            <p className="mt-2 font-display text-2xl font-bold text-silver-2">
              {formatarMoeda(resumoFinanceiro.aReceberNoMes)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Em atraso</p>
            <p className="mt-2 font-display text-2xl font-bold text-red-700">
              {formatarMoeda(resumoFinanceiro.totalAtrasado)}
            </p>
            {resumoFinanceiro.parcelasAtrasadasCount > 0 && (
              <p className="mt-1 text-xs text-muted">
                {resumoFinanceiro.parcelasAtrasadasCount} parcela(s) vencida(s) sem pagamento.
              </p>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <CardTitle>Minhas tarefas</CardTitle>
          </div>
          {tarefas.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma tarefa pendente. Você está em dia.</p>
          ) : (
            <ul className="space-y-3">
              {tarefas.map((tarefa) => (
                <TarefaDashboardItem key={tarefa.id} tarefa={tarefa} />
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <CardTitle>Próximos prazos</CardTitle>
            <LinkButton href="/app/prazos" variant="ghost" size="sm">
              Gerenciar
            </LinkButton>
          </div>
          {prazos.length === 0 ? (
            <p className="text-sm text-muted">Nenhum prazo em aberto. Você está em dia.</p>
          ) : (
            <ul className="space-y-3">
              {prazos.map((prazo) => {
                const urgencia = urgenciaPrazo(diasAte(prazo.data_prazo));
                return (
                  <li key={prazo.id} className="flex items-center justify-between gap-3 rounded-lg border-b border-ink/10 px-1 -mx-1 pb-3 transition-colors duration-150 ease-out last:border-0 last:pb-0 active:bg-ink/5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ice">{prazo.titulo}</p>
                      <p className="text-xs text-muted">
                        {formatarData(prazo.data_prazo)}
                        {prazo.cliente_nome ? ` · ${prazo.cliente_nome}` : ""}
                      </p>
                    </div>
                    <Badge tone={urgencia.tone}>{urgencia.label}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <CardTitle>Fichas de triagem não lidas</CardTitle>
            <LinkButton href="/app/fichas" variant="ghost" size="sm">
              Ver fichas
            </LinkButton>
          </div>
          {fichas.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma ficha pendente de leitura.</p>
          ) : (
            <ul className="space-y-3">
              {fichas.map((ficha) => (
                <li key={ficha.id}>
                  <Link
                    href={`/app/fichas/${ficha.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border-b border-ink/10 px-1 -mx-1 pb-3 transition-all duration-150 ease-out last:border-0 last:pb-0 hover:opacity-80 active:scale-[0.98] active:bg-ink/5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ice">
                        {ficha.nome_cliente ?? "Cliente sem nome"}
                      </p>
                      <p className="truncate text-xs text-muted">{ficha.area_direito ?? "Área não informada"}</p>
                    </div>
                    <Badge tone={ficha.urgencia === "alta" ? "red" : ficha.urgencia === "normal" ? "silver" : "muted"}>
                      {ficha.urgencia}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
