import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { entregarWebhook, type EventoWebhook } from "@/lib/webhooks/deliver";

/**
 * Emissor central de webhooks de saída (Fase 22).
 *
 * Fluxo por evento:
 *   1. Busca endpoints ATIVOS do escritório cujo `eventos` contenha o evento
 *      ou `{all}`;
 *   2. Para cada um, cria uma row `webhook_deliveries` com status `pendente`;
 *   3. Dispara a entrega real (POST assinado — `lib/webhooks/deliver.ts`)
 *      FIRE-AND-FORGET: as entregas individuais NÃO são aguardadas; apenas
 *      um `Promise.allSettled(...)` com catch global recolhe os resultados
 *      para atualizar cada delivery (status, código HTTP, tentativas).
 *
 * ⚠️ RETRY AUTOMÁTICO NÃO IMPLEMENTADO NESTA LEVA: o re-agendamento usará
 * `calcularProximaTentativa` (`lib/webhooks/deliver.ts`) num cron futuro,
 * que lerá deliveries com status 'falha' e tentativas < MAX_TENTATIVAS_ENTREGA
 * e reexecutará `entregarWebhook` incrementando `tentativas`. Hoje uma falha
 * fica registrada como 'falha' para auditoria na UI de Integrações.
 *
 * CONTRATO: best-effort TOTAL. Esta função nunca lança — qualquer erro
 * (banco fora do ar, RLS, rede) é logado e ignorado, porque um webhook não
 * pode derrubar a operação de negócio que o originou (criação de prazo etc.).
 */

type EndpointParaEntrega = {
  id: string;
  url: string;
  secret: string;
  eventos: string[] | null;
};

function endpointEscuta(endpoint: EndpointParaEntrega, evento: EventoWebhook): boolean {
  const eventos = endpoint.eventos ?? [];
  return eventos.includes("all") || eventos.includes(evento);
}

export function emitirEventoWebhook(
  supabase: SupabaseClient,
  escritorioId: string,
  evento: EventoWebhook,
  payload: unknown,
): void {
  // Corpo inteiro dentro de um IIFE assíncrono para manter a assinatura
  // síncrona/void (chamador nunca espera) e o try/catch global garantindo
  // o contrato best-effort.
  void (async () => {
    try {
      const { data: endpoints, error } = await supabase
        .from("webhook_endpoints")
        .select("id, url, secret, eventos")
        .eq("escritorio_id", escritorioId)
        .eq("ativo", true)
        .returns<EndpointParaEntrega[]>();

      if (error) {
        console.error("[webhooks/emitir] Falha ao buscar endpoints:", error, { escritorioId, evento });
        return;
      }

      const alvos = (endpoints ?? []).filter((endpoint) => endpointEscuta(endpoint, evento));
      if (alvos.length === 0) return;

      const entregas = alvos.map(async (endpoint) => {
        // 1) Row pendente ANTES da entrega: se o processo morrer no meio,
        //    a delivery fica 'pendente' — rastro auditável do que foi disparado.
        const { data: criada, error: erroInsert } = await supabase
          .from("webhook_deliveries")
          .insert({
            escritorio_id: escritorioId,
            endpoint_id: endpoint.id,
            evento,
            payload,
          })
          .select("id")
          .single<{ id: string }>();

        if (erroInsert || !criada) {
          console.error("[webhooks/emitir] Falha ao criar delivery:", erroInsert, {
            escritorioId,
            endpointId: endpoint.id,
            evento,
          });
          return;
        }

        // 2) Entrega real (nunca lança — contrato de deliver.ts).
        const resultado = await entregarWebhook({
          url: endpoint.url,
          secret: endpoint.secret,
          evento,
          payload,
        });

        // 3) Atualização final da delivery (tentativas=1: primeira tentativa
        //    concluída). O cron futuro incrementará a partir daqui.
        const agoraIso = new Date().toISOString();
        const { error: erroUpdate } = await supabase
          .from("webhook_deliveries")
          .update(
            resultado.ok
              ? {
                  status: "entregue" as const,
                  resposta_status: resultado.status ?? null,
                  tentativas: 1,
                  entregue_em: agoraIso,
                }
              : {
                  status: "falha" as const,
                  resposta_status: resultado.status ?? null,
                  tentativas: 1,
                  ultimo_erro: resultado.erro ?? "Erro desconhecido.",
                },
          )
          .eq("id", criada.id);

        if (erroUpdate) {
          console.error("[webhooks/emitir] Falha ao atualizar delivery:", erroUpdate, { deliveryId: criada.id });
        }
      });

      // Fire-and-forget: recolhe resultados sem propagar rejeição.
      Promise.allSettled(entregas).then((resultados) => {
        for (const resultado of resultados) {
          if (resultado.status === "rejected") {
            console.error("[webhooks/emitir] Entrega rejeitada inesperadamente:", resultado.reason, {
              escritorioId,
              evento,
            });
          }
        }
      });
    } catch (erro) {
      // Catch global: nenhuma condição desta função pode estourar no fluxo
      // de negócio que a chamou.
      console.error("[webhooks/emitir] Erro inesperado ao emitir webhook:", erro, { escritorioId, evento });
    }
  })();
}
