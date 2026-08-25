"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { planoTemAcesso } from "@/lib/planos/gating";
import { gerarSecretWebhook } from "@/lib/webhooks/signer";
import {
  EVENTOS_WEBHOOK,
  validarUrlWebhook,
  type EventoWebhook,
} from "@/lib/webhooks/deliver";

/** Item de listagem de endpoints — NUNCA inclui `secret` (só na criação). */
export type WebhookEndpointListado = {
  id: string;
  url: string;
  descricao: string | null;
  eventos: string[];
  ativo: boolean;
  criadoEm: string;
};

/** Última delivery de um endpoint — para o log exibido na UI. */
export type WebhookDeliveryListada = {
  id: string;
  evento: string;
  status: "pendente" | "entregue" | "falha";
  tentativas: number;
  respostaStatus: number | null;
  ultimoErro: string | null;
  criadoEm: string;
  entregueEm: string | null;
};

const MENSAGEM_SEM_ACESSO = "Integrações/webhooks é um recurso do plano Pro.";

async function exigirContexto(): Promise<
  { ok: true; escritorioId: string } | { ok: false; erro: string }
> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, erro: "Sessão expirada. Faça login novamente." };
  if (!planoTemAcesso(usuario.perfil.escritorio, "api_integracoes")) {
    return { ok: false, erro: MENSAGEM_SEM_ACESSO };
  }
  return { ok: true, escritorioId: usuario.perfil.escritorio_id };
}

/** Lista os endpoints do escritório (mais recentes primeiro) — usado pela page e após mutações. */
export async function listarEndpointsAction(): Promise<WebhookEndpointListado[]> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return [];
  if (!planoTemAcesso(usuario.perfil.escritorio, "api_integracoes")) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("webhook_endpoints")
    .select("id, url, descricao, eventos, ativo, criado_em")
    .eq("escritorio_id", usuario.perfil.escritorio_id)
    .order("criado_em", { ascending: false });

  if (error || !data) {
    if (error) console.error("[integracoes/actions] Falha ao listar endpoints:", error);
    return [];
  }

  return data.map((linha) => ({
    id: linha.id,
    url: linha.url,
    descricao: linha.descricao ?? null,
    eventos: Array.isArray(linha.eventos) ? linha.eventos : ["all"],
    ativo: linha.ativo,
    criadoEm: linha.criado_em,
  }));
}

/** Últimas 20 deliveries de um endpoint (mais recentes primeiro). */
export async function listarDeliveriesAction(endpointId: string): Promise<WebhookDeliveryListada[]> {
  const contexto = await exigirContexto();
  if (!contexto.ok) return [];

  const id = z.string().uuid().safeParse(endpointId);
  if (!id.success) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("webhook_deliveries")
    .select("id, evento, status, tentativas, resposta_status, ultimo_erro, criado_em, entregue_em")
    .eq("escritorio_id", contexto.escritorioId)
    .eq("endpoint_id", id.data)
    .order("criado_em", { ascending: false })
    .limit(20);

  if (error || !data) {
    if (error) console.error("[integracoes/actions] Falha ao listar deliveries:", error);
    return [];
  }

  return data.map((linha) => ({
    id: linha.id,
    evento: linha.evento,
    status: linha.status as WebhookDeliveryListada["status"],
    tentativas: linha.tentativas,
    respostaStatus: linha.resposta_status ?? null,
    ultimoErro: linha.ultimo_erro ?? null,
    criadoEm: linha.criado_em,
    entregueEm: linha.entregue_em ?? null,
  }));
}

// ── Criar ────────────────────────────────────────────────────────────────

const criarSchema = z.object({
  url: z.string().trim().min(1, "Informe a URL do webhook.").max(2000, "URL muito longa."),
  descricao: z.string().trim().max(300, "Descrição deve ter no máximo 300 caracteres."),
  eventos: z.array(z.enum(EVENTOS_WEBHOOK)).max(EVENTOS_WEBHOOK.length),
});

export type CriarEndpointState = {
  error: string | null;
  /** Só preenchido na resposta IMEDIATA da criação — nunca recuperável depois. */
  segredoNovo: string | null;
};

/**
 * Cria um endpoint com segredo HMAC gerado automaticamente (exibido UMA vez).
 * Validações: zod (shape) → validarUrlWebhook (https + SSRF básico) → insert.
 * Gate de plano roda ANTES de qualquer efeito colateral.
 */
export async function criarEndpointAction(_prev: CriarEndpointState, formData: FormData): Promise<CriarEndpointState> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { error: "Sessão expirada. Faça login novamente.", segredoNovo: null };
  if (!planoTemAcesso(usuario.perfil.escritorio, "api_integracoes")) {
    return { error: MENSAGEM_SEM_ACESSO, segredoNovo: null };
  }

  const parsed = criarSchema.safeParse({
    url: formData.get("url"),
    descricao: formData.get("descricao") ?? "",
    eventos: formData.getAll("eventos").filter((v): v is string => typeof v === "string"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos.", segredoNovo: null };
  }

  const validacaoUrl = validarUrlWebhook(parsed.data.url);
  if (!validacaoUrl.ok) {
    return { error: validacaoUrl.erro, segredoNovo: null };
  }

  // Nenhum checkbox marcado = quer todos os eventos → armazenamos {all}.
  const eventos =
    parsed.data.eventos.length === 0 ? ["all"] : ([...new Set(parsed.data.eventos)] as EventoWebhook[]);

  const secret = gerarSecretWebhook();
  const supabase = await createClient();
  const { error } = await supabase.from("webhook_endpoints").insert({
    escritorio_id: usuario.perfil.escritorio_id,
    url: parsed.data.url,
    descricao: parsed.data.descricao === "" ? null : parsed.data.descricao,
    eventos,
    secret,
  });

  if (error) {
    console.error("[integracoes/actions] Falha ao criar endpoint:", error, {
      escritorioId: usuario.perfil.escritorio_id,
    });
    return { error: "Não foi possível criar o webhook. Tente novamente.", segredoNovo: null };
  }

  revalidatePath("/app/integracoes");
  return { error: null, segredoNovo: secret };
}

// ── Toggle ativo / Excluir ───────────────────────────────────────────────

type EstadoSimples = { error: string | null };

const idSchema = z.object({ id: z.string().uuid() });

function parseId(formData: FormData): string | null {
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  return parsed.success ? parsed.data.id : null;
}

/** Ativa/desativa um endpoint (desativar para de receber entregas, mantém histórico). */
export async function alternarEndpointAtivoAction(
  _prev: EstadoSimples,
  formData: FormData,
): Promise<EstadoSimples> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { error: "Sessão expirada. Faça login novamente." };
  if (!planoTemAcesso(usuario.perfil.escritorio, "api_integracoes")) {
    return { error: MENSAGEM_SEM_ACESSO };
  }

  const id = parseId(formData);
  if (!id) return { error: "Webhook inválido." };

  const supabase = await createClient();

  // Lê o estado atual para alternar — RLS garante que só endpoints do
  // próprio escritório aparecem; o .eq explícito documenta a intenção.
  const { data: atual } = await supabase
    .from("webhook_endpoints")
    .select("ativo")
    .eq("id", id)
    .eq("escritorio_id", usuario.perfil.escritorio_id)
    .maybeSingle<{ ativo: boolean }>();

  if (!atual) return { error: "Webhook não encontrado." };

  const { error } = await supabase
    .from("webhook_endpoints")
    .update({ ativo: !atual.ativo })
    .eq("id", id)
    .eq("escritorio_id", usuario.perfil.escritorio_id);

  if (error) {
    console.error("[integracoes/actions] Falha ao alternar endpoint:", error, { endpointId: id });
    return { error: "Não foi possível alterar o webhook. Tente novamente." };
  }

  revalidatePath("/app/integracoes");
  return { error: null };
}

/** Exclui o endpoint E suas deliveries (cascade — ver migration 0047). */
export async function excluirEndpointAction(_prev: EstadoSimples, formData: FormData): Promise<EstadoSimples> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { error: "Sessão expirada. Faça login novamente." };
  if (!planoTemAcesso(usuario.perfil.escritorio, "api_integracoes")) {
    return { error: MENSAGEM_SEM_ACESSO };
  }

  const id = parseId(formData);
  if (!id) return { error: "Webhook inválido." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("webhook_endpoints")
    .delete()
    .eq("id", id)
    .eq("escritorio_id", usuario.perfil.escritorio_id);

  if (error) {
    console.error("[integracoes/actions] Falha ao excluir endpoint:", error, { endpointId: id });
    return { error: "Não foi possível excluir o webhook. Tente novamente." };
  }

  revalidatePath("/app/integracoes");
  return { error: null };
}
