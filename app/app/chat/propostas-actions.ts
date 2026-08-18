"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { reindexarFichaCaso, reindexarPrazo } from "@/lib/rag/indexacao-interna";
import type { PropostaAcao } from "@/lib/types";

export type ResultadoProposta = { ok: true } | { ok: false; error: string };

const uuidSchema = z.string().uuid();

export async function buscarPropostaAction(propostaId: string): Promise<PropostaAcao | null> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return null;
  const parsed = uuidSchema.safeParse(propostaId);
  if (!parsed.success) return null;

  const supabase = await createClient();
  const { data } = await supabase.from("propostas_acao").select("*").eq("id", parsed.data).maybeSingle();
  return (data as PropostaAcao) ?? null;
}

/**
 * Carrega e valida uma proposta pendente. Trata proposta expirada (>24h sem
 * resolução) como caminho de escape automático: nunca fica pendurada
 * indefinidamente esperando aprovação de uma ação potencialmente
 * desatualizada — é marcada como 'expired' e recusada.
 */
type CargaProposta = { bloqueada: false; proposta: PropostaAcao } | { bloqueada: true; motivo: string };

async function carregarPropostaPendente(
  supabase: Awaited<ReturnType<typeof createClient>>,
  propostaId: string,
): Promise<CargaProposta> {
  const { data, error } = await supabase.from("propostas_acao").select("*").eq("id", propostaId).maybeSingle();
  if (error || !data) return { bloqueada: true, motivo: "Proposta não encontrada." };

  const proposta = data as PropostaAcao;
  if (proposta.status !== "pending") {
    return { bloqueada: true, motivo: "Esta proposta já foi resolvida anteriormente." };
  }

  if (new Date(proposta.expira_em).getTime() < Date.now()) {
    await supabase
      .from("propostas_acao")
      .update({ status: "expired", resolvido_em: new Date().toISOString() })
      .eq("id", proposta.id);
    return {
      bloqueada: true,
      motivo: "Esta proposta expirou (mais de 24h pendente) e foi descartada automaticamente.",
    };
  }

  return { bloqueada: false, proposta };
}

export async function rejeitarPropostaAction(propostaId: string): Promise<ResultadoProposta> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const parsed = uuidSchema.safeParse(propostaId);
  if (!parsed.success) return { ok: false, error: "Proposta inválida." };

  const supabase = await createClient();
  const carregada = await carregarPropostaPendente(supabase, parsed.data);
  if (carregada.bloqueada) return { ok: false, error: carregada.motivo };

  const { error } = await supabase
    .from("propostas_acao")
    .update({ status: "rejected", resolvido_em: new Date().toISOString(), resolvido_por: usuario.perfil.id })
    .eq("id", parsed.data);

  if (error) return { ok: false, error: "Não foi possível rejeitar a proposta." };

  revalidatePath("/app/chat");
  return { ok: true };
}

export async function aprovarPropostaAction(propostaId: string): Promise<ResultadoProposta> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const parsed = uuidSchema.safeParse(propostaId);
  if (!parsed.success) return { ok: false, error: "Proposta inválida." };

  const supabase = await createClient();
  const carregada = await carregarPropostaPendente(supabase, parsed.data);
  if (carregada.bloqueada) return { ok: false, error: carregada.motivo };
  const proposta = carregada.proposta;

  const { escritorio_id: escritorioId, id: perfilId } = usuario.perfil;
  const agora = new Date().toISOString();

  try {
    switch (proposta.tipo) {
      case "update_prazo": {
        const payload = proposta.payload as { prazo_id: string; mudancas: Record<string, unknown> };
        const { error } = await supabase.from("prazos").update(payload.mudancas).eq("id", payload.prazo_id);
        if (error) throw new Error(error.message);
        await reindexarPrazo(supabase, escritorioId, payload.prazo_id);
        break;
      }
      case "update_ficha": {
        const payload = proposta.payload as { ficha_id: string; mudancas: Record<string, unknown> };
        const { error } = await supabase.from("fichas_caso").update(payload.mudancas).eq("id", payload.ficha_id);
        if (error) throw new Error(error.message);
        await reindexarFichaCaso(supabase, escritorioId, payload.ficha_id);
        break;
      }
      case "create_prazo": {
        const payload = proposta.payload as { dados: Record<string, unknown> };
        const { data: novo, error } = await supabase
          .from("prazos")
          .insert({ ...payload.dados, escritorio_id: escritorioId, criado_por: perfilId })
          .select("id")
          .single();
        if (error || !novo) throw new Error(error?.message ?? "Falha ao criar prazo.");
        await reindexarPrazo(supabase, escritorioId, novo.id);
        break;
      }
      case "create_ficha": {
        const payload = proposta.payload as { dados: Record<string, unknown> };
        const { data: nova, error } = await supabase
          .from("fichas_caso")
          .insert({ ...payload.dados, escritorio_id: escritorioId, conversa_id: proposta.conversa_id })
          .select("id")
          .single();
        if (error || !nova) throw new Error(error?.message ?? "Falha ao criar ficha.");
        await reindexarFichaCaso(supabase, escritorioId, nova.id);
        break;
      }
      case "generate_documento": {
        // Nada a escrever em tabela de negócio: o arquivo é gerado sob demanda
        // no download (rota /api/propostas/[id]/documento), a partir do
        // payload já validado. Aprovar aqui só libera o link de download.
        break;
      }
    }

    await supabase
      .from("propostas_acao")
      .update({
        status: proposta.tipo === "generate_documento" ? "approved" : "applied",
        resolvido_em: agora,
        resolvido_por: perfilId,
      })
      .eq("id", proposta.id);
  } catch (erro) {
    await supabase
      .from("propostas_acao")
      .update({
        status: "failed",
        erro: erro instanceof Error ? erro.message : "Erro desconhecido ao aplicar a proposta.",
        resolvido_em: agora,
        resolvido_por: perfilId,
      })
      .eq("id", proposta.id);
    return { ok: false, error: "Não foi possível aplicar a ação. A proposta foi marcada como falha." };
  }

  revalidatePath("/app/chat");
  revalidatePath("/app/prazos");
  revalidatePath("/app/fichas");
  revalidatePath("/app/dashboard");
  return { ok: true };
}
