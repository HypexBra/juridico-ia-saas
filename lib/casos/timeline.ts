import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import type { EventoCaso, OrigemEventoCaso } from "@/lib/types";

export type RegistrarEventoCasoInput = {
  escritorioId: string;
  fichaCasoId: string;
  tipoEvento: string;
  descricao: string;
  /** ISO 8601. Default: momento da chamada (`now()`), igual ao default da coluna. */
  dataEvento?: string;
  origem: OrigemEventoCaso;
  /** Id do registro concreto que originou o evento (ex.: prazo, petição, sincronização DJEN). */
  referenciaId?: string | null;
  criadoPor?: string | null;
};

export type ResultadoRegistrarEventoCaso =
  | { ok: true; evento: EventoCaso }
  | { ok: false; error: string };

/**
 * Insere um evento na linha do tempo do caso (`eventos_caso`, append-only —
 * migration 0024, "Caso Inteligente" Fase 1).
 *
 * Contrato importante para quem chama: este hook roda sempre DEPOIS da
 * operação principal já ter tido sucesso (criar prazo, gerar documento,
 * assinatura concluída etc.) e NUNCA deve derrubar esse fluxo — em caso de
 * falha aqui, loga e devolve `{ ok: false }`; nunca lança. Chamadores que
 * não têm um `ficha_caso_id` disponível no contexto (ex.: prazo criado sem
 * vínculo a nenhuma ficha) simplesmente não chamam esta função — não há
 * "evento sem ficha" válido, já que a coluna é `not null`.
 */
export async function registrarEventoCaso(
  supabase: SupabaseClient,
  input: RegistrarEventoCasoInput,
): Promise<ResultadoRegistrarEventoCaso> {
  const tipoEvento = input.tipoEvento.trim();
  const descricao = input.descricao.trim();

  if (!input.escritorioId || !input.fichaCasoId) {
    return { ok: false, error: "escritorio_id e ficha_caso_id são obrigatórios para registrar o evento." };
  }
  if (!tipoEvento || !descricao) {
    return { ok: false, error: "tipo_evento e descricao são obrigatórios para registrar o evento." };
  }

  const { data, error } = await supabase
    .from("eventos_caso")
    .insert({
      escritorio_id: input.escritorioId,
      ficha_caso_id: input.fichaCasoId,
      tipo_evento: tipoEvento,
      descricao,
      data_evento: input.dataEvento ?? new Date().toISOString(),
      origem: input.origem,
      referencia_id: input.referenciaId ?? null,
      criado_por: input.criadoPor ?? null,
    })
    .select("*")
    .single<EventoCaso>();

  if (error || !data) {
    console.error("[casos/timeline] Falha ao registrar evento na linha do tempo do caso:", error, {
      fichaCasoId: input.fichaCasoId,
      tipoEvento,
      origem: input.origem,
    });
    return { ok: false, error: "Não foi possível registrar o evento na linha do tempo do caso." };
  }

  return { ok: true, evento: data };
}

export type ListarEventosCasoResultado =
  | { ok: true; eventos: EventoCaso[] }
  | { ok: false; error: string };

/**
 * Server Action de leitura: lista a linha do tempo de uma ficha, mais
 * recente primeiro (`data_evento desc`) — RLS de `eventos_caso`
 * (`escritorio_id = escritorio_atual()`) já garante isolamento por tenant.
 */
export async function listarEventosCasoAction(fichaCasoId: string): Promise<ListarEventosCasoResultado> {
  "use server";

  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  if (!fichaCasoId) return { ok: false, error: "Ficha inválida." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("eventos_caso")
    .select("*")
    .eq("ficha_caso_id", fichaCasoId)
    .order("data_evento", { ascending: false })
    .returns<EventoCaso[]>();

  if (error) {
    console.error("[casos/timeline] Falha ao listar eventos da linha do tempo do caso:", error, { fichaCasoId });
    return { ok: false, error: "Não foi possível carregar a linha do tempo do caso." };
  }

  return { ok: true, eventos: data ?? [] };
}
