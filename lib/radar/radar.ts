import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * RADAR JURÍDICO + IA PROATIVA — "O que preciso saber hoje?" (Fases 10 e 11
 * do roadmap). Filosofia: os SINAIS são coletados de forma DETERMINÍSTICA
 * (queries reais no banco — zero número inventado); a IA entra só na CAMADA
 * DE SÍNTESE sob demanda, recebendo os sinais estruturados como única fonte.
 * Se um sinal não existe no banco, ele não aparece no radar — nunca há
 * "dashboard com números inventados".
 */

export type SinalRadar = {
  codigo:
    | "prazo_vencido"
    | "prazo_hoje"
    | "prazo_3dias"
    | "tarefa_atrasada"
    | "ficha_nao_lida"
    | "mensagem_portal_sem_leitura"
    | "caso_sem_atividade"
    | "proposta_pendente"
    | "parcela_vencida";
  severidade: "alta" | "media" | "baixa";
  titulo: string;
  detalhe: string;
  /** Rota de destino do alerta — o clique leva direto ao que exige ação. */
  href?: string;
};

export type RadarSinais = {
  prazosVencidos: { id: string; titulo: string; dataPrazo: string; clienteNome: string | null }[];
  prazosHoje: { id: string; titulo: string; clienteNome: string | null }[];
  prazos3Dias: { id: string; titulo: string; dataPrazo: string; clienteNome: string | null }[];
  tarefasAtrasadas: { id: string; titulo: string; prazoOpcional: string | null; fichaId: string }[];
  fichasNaoLidas: number;
  mensagensPortalNaoLidas: number;
  casosSemAtividadeDias: number;
  propostasPendentes: number;
  parcelasVencidas: { id: string; vencimento: string; valor: number }[];
  coletadoEm: string;
};

const DIAS_CASO_SEM_ATIVIDADE = 30;

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Coleta TODOS os sinais em paralelo (uma rodada só de queries). O isolamento
 * de tenant é garantido pela RLS do client de sessão (todas as tabelas lidas
 * têm policy `escritorio_id = escritorio_atual()`) — não precisa (nem deve)
 * filtrar manualmente por escritório aqui.
 */
export async function coletarSinaisRadar(supabase: SupabaseClient): Promise<RadarSinais> {
  const hoje = hojeIso();
  const em3Dias = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  const limiteInatividade = new Date(Date.now() - DIAS_CASO_SEM_ATIVIDADE * 86_400_000).toISOString();
  const inicioMesAnteriorMenos90 = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);

  const [
    prazosRes,
    tarefasRes,
    fichasNaoLidasRes,
    mensagensRes,
    fichasInativasRes,
    propostasRes,
    parcelasRes,
  ] = await Promise.all([
    supabase
      .from("prazos")
      .select("id, titulo, data_prazo, cliente_nome")
      .eq("concluido", false)
      .gte("data_prazo", inicioMesAnteriorMenos90)
      .lte("data_prazo", em3Dias)
      .order("data_prazo", { ascending: true })
      .limit(50),
    supabase
      .from("tarefas_caso")
      .select("id, titulo, prazo_opcional, ficha_caso_id")
      .neq("status", "concluida")
      .not("prazo_opcional", "is", null)
      .lt("prazo_opcional", hoje)
      .limit(30),
    supabase
      .from("fichas_caso")
      .select("id", { count: "exact", head: true })
      .eq("lida", false),
    // Mensagens de CLIENTE não lidas pelo escritório (portal rico, Pro).
    supabase
      .from("mensagens_portal_cliente")
      .select("id", { count: "exact", head: true })
      .eq("lida", false)
      .eq("remetente", "cliente"),
    supabase
      .from("fichas_caso")
      .select("id", { count: "exact", head: true })
      .lt("status_processual_atualizado_em", limiteInatividade)
      .is("deletado_em", null)
      .in("status_processual", ["ativa", "protocolada"]),
    supabase.from("propostas_acao").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase
      .from("parcelas_honorario")
      .select("id, vencimento, valor")
      .neq("status", "pago")
      .lt("vencimento", hoje)
      .order("vencimento", { ascending: true })
      .limit(20),
  ]);

  const prazos = (prazosRes.data ?? []) as { id: string; titulo: string; data_prazo: string; cliente_nome: string | null }[];

  return {
    prazosVencidos: prazos.filter((p) => p.data_prazo < hoje).map((p) => ({ id: p.id, titulo: p.titulo, dataPrazo: p.data_prazo, clienteNome: p.cliente_nome })),
    prazosHoje: prazos.filter((p) => p.data_prazo === hoje).map((p) => ({ id: p.id, titulo: p.titulo, clienteNome: p.cliente_nome })),
    prazos3Dias: prazos.filter((p) => p.data_prazo > hoje && p.data_prazo <= em3Dias).map((p) => ({ id: p.id, titulo: p.titulo, dataPrazo: p.data_prazo, clienteNome: p.cliente_nome })),
    tarefasAtrasadas: ((tarefasRes.data ?? []) as { id: string; titulo: string; prazo_opcional: string | null; ficha_caso_id: string }[]).map((t) => ({
      id: t.id,
      titulo: t.titulo,
      prazoOpcional: t.prazo_opcional,
      fichaId: t.ficha_caso_id,
    })),
    fichasNaoLidas: fichasNaoLidasRes.count ?? 0,
    mensagensPortalNaoLidas: mensagensRes.count ?? 0,
    casosSemAtividadeDias: fichasInativasRes.count ?? 0,
    propostasPendentes: propostasRes.count ?? 0,
    parcelasVencidas: ((parcelasRes.data ?? []) as { id: string; vencimento: string; valor: number }[]).map((p) => ({
      id: p.id,
      vencimento: p.vencimento,
      valor: typeof p.valor === "number" ? p.valor : Number(p.valor) || 0,
    })),
    coletadoEm: new Date().toISOString(),
  };
}

/**
 * Camada determinística de priorização — roda SEMPRE, sem custo de IA.
 * Ordem de severidade: prazo é inalienável (vencido/hoje > tudo), depois
 * dinheiro vencido, depois comunicação parada, depois higiene operacional.
 */
export function classificarSinais(sinais: RadarSinais): SinalRadar[] {
  const sinaisOrdenados: SinalRadar[] = [];

  if (sinais.prazosVencidos.length > 0) {
    sinaisOrdenados.push({
      codigo: "prazo_vencido",
      severidade: "alta",
      titulo: `${sinais.prazosVencidos.length} prazo(s) VENCIDO(S)`,
      detalhe: `Mais urgente: "${sinais.prazosVencidos[0].titulo}" (${sinais.prazosVencidos[0].clienteNome ?? "sem cliente"}) — venceu em ${sinais.prazosVencidos[0].dataPrazo.split("-").reverse().join("/")}.`,
      href: "/app/prazos",
    });
  }
  if (sinais.prazosHoje.length > 0) {
    sinaisOrdenados.push({
      codigo: "prazo_hoje",
      severidade: "alta",
      titulo: `${sinais.prazosHoje.length} prazo(s) para HOJE`,
      detalhe: sinais.prazosHoje.map((p) => `"${p.titulo}"`).slice(0, 3).join(", "),
      href: "/app/prazos",
    });
  }
  if (sinais.tarefasAtrasadas.length > 0) {
    sinaisOrdenados.push({
      codigo: "tarefa_atrasada",
      severidade: "alta",
      titulo: `${sinais.tarefasAtrasadas.length} tarefa(s) atrasada(s)`,
      detalhe: `Ex.: "${sinais.tarefasAtrasadas[0].titulo}".`,
      href: "/app/dashboard",
    });
  }
  if (sinais.parcelasVencidas.length > 0) {
    const total = sinais.parcelasVencidas.reduce((soma, p) => soma + p.valor, 0);
    sinaisOrdenados.push({
      codigo: "parcela_vencida",
      severidade: "media",
      titulo: `${sinais.parcelasVencidas.length} parcela(s) de honorário vencida(s)`,
      detalhe: `Total pendente: ${total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`,
      href: "/app/financeiro",
    });
  }
  if (sinais.mensagensPortalNaoLidas > 0) {
    sinaisOrdenados.push({
      codigo: "mensagem_portal_sem_leitura",
      severidade: "media",
      titulo: `${sinais.mensagensPortalNaoLidas} mensagem(ns) de cliente sem leitura`,
      detalhe: "Cliente aguardando resposta pelo portal.",
      href: "/app/fichas",
    });
  }
  if (sinais.fichasNaoLidas > 0) {
    sinaisOrdenados.push({
      codigo: "ficha_nao_lida",
      severidade: "media",
      titulo: `${sinais.fichasNaoLidas} novo(s) caso(s) sem leitura`,
      detalhe: "Triagem/conversa convertida em ficha que ainda não foi revisada.",
      href: "/app/fichas",
    });
  }
  if (sinais.propostasPendentes > 0) {
    sinaisOrdenados.push({
      codigo: "proposta_pendente",
      severidade: "baixa",
      titulo: `${sinais.propostasPendentes} proposta(s) da IA aguardando aprovação`,
      detalhe: "Propostas expiram em 24h — aprove ou rejeite.",
      href: "/app/dashboard",
    });
  }
  if (sinais.casosSemAtividadeDias > 0 && sinais.casosSemAtividadeDias >= DIAS_CASO_SEM_ATIVIDADE) {
    sinaisOrdenados.push({
      codigo: "caso_sem_atividade",
      severidade: "baixa",
      titulo: `${sinais.casosSemAtividadeDias} caso(s) sem movimentação há 30+ dias`,
      detalhe: "Vale conferir se algum precisa de diligência ou comunicação ao cliente.",
      href: "/app/fichas",
    });
  }

  const ordemSeveridade = { alta: 0, media: 1, baixa: 2 } as const;
  return sinaisOrdenados.sort((a, b) => ordemSeveridade[a.severidade] - ordemSeveridade[b.severidade]);
}
