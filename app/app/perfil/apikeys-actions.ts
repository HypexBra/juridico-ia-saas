"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { planoTemAcesso } from "@/lib/planos/gating";
import { gerarApiKey } from "@/lib/apikeys/gerar";

/** Item de listagem — NUNCA inclui a chave completa nem o hash, só o que é seguro exibir. */
export type ApiKeyListada = {
  id: string;
  nome: string;
  prefixoVisivel: string;
  ativa: boolean;
  criadoEm: string;
  ultimaUtilizacaoEm: string | null;
};

const MENSAGEM_SEM_ACESSO = "API/integrações é um recurso do plano Pro.";

/** Busca as chaves do escritório do usuário logado — usado tanto pela page (render inicial) quanto após criar/revogar. */
export async function listarApiKeysAction(): Promise<ApiKeyListada[]> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("api_keys")
    .select("id, nome, prefixo_visivel, ativa, criado_em, ultima_utilizacao_em")
    .eq("escritorio_id", usuario.perfil.escritorio_id)
    .order("criado_em", { ascending: false });

  if (error || !data) {
    if (error) console.error("[perfil/apikeys-actions] Falha ao listar chaves:", error);
    return [];
  }

  return data.map((linha) => ({
    id: linha.id,
    nome: linha.nome,
    prefixoVisivel: linha.prefixo_visivel,
    ativa: linha.ativa,
    criadoEm: linha.criado_em,
    ultimaUtilizacaoEm: linha.ultima_utilizacao_em,
  }));
}

const criarSchema = z.object({
  nome: z.string().trim().min(2, "Dê um nome para identificar esta chave (ex: “Zapier”, “n8n”).").max(100),
});

export type CriarApiKeyState = {
  error: string | null;
  /** Só preenchido na resposta IMEDIATA da criação — nunca recuperável depois. */
  chaveCompleta: string | null;
  chaves: ApiKeyListada[];
};

/**
 * Cria uma nova API key para o escritório. Gate de plano é obrigatório e
 * roda ANTES de qualquer efeito colateral (nenhuma linha é gravada se o
 * escritório não tiver a feature). A chave completa só é retornada aqui,
 * nesta resposta — nunca é persistida em texto puro nem logada.
 */
export async function criarApiKeyAction(_prev: CriarApiKeyState, formData: FormData): Promise<CriarApiKeyState> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { error: "Sessão expirada. Faça login novamente.", chaveCompleta: null, chaves: [] };

  if (!planoTemAcesso(usuario.perfil.escritorio, "api_integracoes")) {
    return { error: MENSAGEM_SEM_ACESSO, chaveCompleta: null, chaves: await listarApiKeysAction() };
  }

  const parsed = criarSchema.safeParse({ nome: formData.get("nome") });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Nome inválido.",
      chaveCompleta: null,
      chaves: await listarApiKeysAction(),
    };
  }

  const { chaveCompleta, chaveHash, prefixoVisivel } = gerarApiKey();

  const supabase = await createClient();
  const { error } = await supabase.from("api_keys").insert({
    escritorio_id: usuario.perfil.escritorio_id,
    nome: parsed.data.nome,
    chave_hash: chaveHash,
    prefixo_visivel: prefixoVisivel,
    criado_por: usuario.perfil.id,
  });

  if (error) {
    // Nunca logar `chaveCompleta`/`chaveHash` mesmo em erro — o motivo do
    // erro do Postgres já é suficiente para diagnosticar sem tocar no segredo.
    console.error("[perfil/apikeys-actions] Falha ao criar chave:", error, {
      escritorioId: usuario.perfil.escritorio_id,
    });
    return { error: "Não foi possível criar a chave. Tente novamente.", chaveCompleta: null, chaves: await listarApiKeysAction() };
  }

  revalidatePath("/app/perfil");
  return { error: null, chaveCompleta, chaves: await listarApiKeysAction() };
}

const revogarSchema = z.object({ id: z.string().uuid() });

export type RevogarApiKeyState = { error: string | null; chaves: ApiKeyListada[] };

/** Revoga (desativa) uma chave — nunca deleta a linha, mantém auditoria (criado_em, criado_por, última utilização). */
export async function revogarApiKeyAction(_prev: RevogarApiKeyState, formData: FormData): Promise<RevogarApiKeyState> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { error: "Sessão expirada. Faça login novamente.", chaves: [] };

  const parsed = revogarSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "Chave inválida.", chaves: await listarApiKeysAction() };

  const supabase = await createClient();
  // RLS (`api_keys_isolamento`) já garante que só uma chave do próprio
  // escritório pode ser afetada, mas o `.eq` explícito documenta a intenção
  // e evita depender só da policy para ler o resultado corretamente.
  const { error } = await supabase
    .from("api_keys")
    .update({ ativa: false })
    .eq("id", parsed.data.id)
    .eq("escritorio_id", usuario.perfil.escritorio_id);

  if (error) {
    console.error("[perfil/apikeys-actions] Falha ao revogar chave:", error, { apiKeyId: parsed.data.id });
    return { error: "Não foi possível revogar a chave. Tente novamente.", chaves: await listarApiKeysAction() };
  }

  revalidatePath("/app/perfil");
  return { error: null, chaves: await listarApiKeysAction() };
}
