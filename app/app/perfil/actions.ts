"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import {
  criarCheckoutSession,
  criarPortalSessionUrl,
  obterAppUrl,
  StripeNaoConfiguradoError,
} from "@/lib/billing/stripe-client";
import { normalizarTom } from "@/lib/ia/contexto-escritorio";
import type { Assinatura } from "@/lib/types";

// Formato NÚMERO/UF (ex: "123456/SP") — é o que a API do DJEN espera como
// numeroOab + ufOab (ver lib/djen/cliente.ts), então valida aqui na origem
// em vez de deixar o cron descobrir um formato ruim uma vez por dia.
const oabSchema = z
  .string()
  .trim()
  .regex(/^\d{1,8}\/[A-Za-z]{2}$/, "Use o formato NÚMERO/UF, ex: 123456/SP.")
  .transform((valor) => valor.toUpperCase());

export type AtualizarOabState = { error: string | null; sucesso: string | null };

/**
 * Cadastro da OAB do próprio advogado — é o dado que liga o perfil à
 * sincronização automática de intimações do DJEN (lib/djen/sincronizar.ts
 * consulta `perfis.oab` de todo perfil ativo no cron diário).
 */
export async function atualizarOabAction(
  _prev: AtualizarOabState,
  formData: FormData,
): Promise<AtualizarOabState> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { error: "Sessão expirada. Faça login novamente.", sucesso: null };

  const bruto = formData.get("oab");
  if (typeof bruto === "string" && bruto.trim() === "") {
    const supabase = await createClient();
    const { error } = await supabase.from("perfis").update({ oab: null }).eq("id", usuario.perfil.id);
    if (error) return { error: "Não foi possível remover a OAB.", sucesso: null };
    revalidatePath("/app/perfil");
    return { error: null, sucesso: "OAB removida. A sincronização automática do DJEN foi desativada para você." };
  }

  const parsed = oabSchema.safeParse(bruto);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "OAB inválida.", sucesso: null };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("perfis").update({ oab: parsed.data }).eq("id", usuario.perfil.id);
  if (error) return { error: "Não foi possível salvar a OAB.", sucesso: null };

  revalidatePath("/app/perfil");
  return {
    error: null,
    sucesso: `OAB ${parsed.data} salva. As intimações novas serão importadas automaticamente 1x/dia como propostas de prazo para você aprovar.`,
  };
}

export type AssinaturaActionState = { error: string | null };

// Limites da memória do escritório (Fase 17) — mesmos maxLength do form no
// client e do textarea na página; validados AQUI na origem também.
const MAX_DIRETRIZES_CHARS = 4000;
const MAX_CLAUSULAS_CHARS = 6000;

const memoriaEscritorioSchema = z.object({
  diretrizes: z
    .string()
    .max(MAX_DIRETRIZES_CHARS, `Diretrizes podem ter no máximo ${MAX_DIRETRIZES_CHARS} caracteres.`)
    .default(""),
  clausulas: z
    .string()
    .max(MAX_CLAUSULAS_CHARS, `Cláusulas padrão podem ter no máximo ${MAX_CLAUSULAS_CHARS} caracteres.`)
    .default(""),
});

export type MemoriaEscritorioState = { error: string | null; sucesso: string | null };

/**
 * Salva a memória do escritório (Fase 17, migration 0046): diretrizes de
 * escrita, tom preferido e cláusulas padrão em `escritorios` — usadas como
 * CONTEXTO opcional nas respostas/minutas da IA. Configuração de escritório:
 * só titular/admin (mesmo critério do guard de gestão de equipe em
 * app/app/equipe/actions.ts); a RLS de `escritorios` continua sendo a
 * garantia real de isolamento cross-tenant. O tom é normalizado de forma
 * tolerante (`normalizarTom`) — valor estranho nunca quebra o save, cai no
 * default "formal".
 */
export async function salvarMemoriaEscritorioAction(
  _prev: MemoriaEscritorioState,
  formData: FormData,
): Promise<MemoriaEscritorioState> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { error: "Sessão expirada. Faça login novamente.", sucesso: null };

  if (usuario.perfil.role !== "owner" && usuario.perfil.role !== "admin") {
    return {
      error: "Só o titular ou administrador(a) do escritório pode editar a memória do escritório.",
      sucesso: null,
    };
  }

  const parsed = memoriaEscritorioSchema.safeParse({
    diretrizes: typeof formData.get("diretrizes") === "string" ? formData.get("diretrizes") : "",
    clausulas: typeof formData.get("clausulas") === "string" ? formData.get("clausulas") : "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos.", sucesso: null };
  }

  const tom = normalizarTom(formData.get("tom"));

  const supabase = await createClient();
  const { error } = await supabase
    .from("escritorios")
    .update({
      diretrizes_ia: parsed.data.diretrizes,
      tom_escrita: tom,
      clausulas_padrao: parsed.data.clausulas,
    })
    .eq("id", usuario.perfil.escritorio_id);

  if (error) {
    console.error("[perfil/salvarMemoriaEscritorioAction] Falha ao salvar memória:", error);
    return { error: "Não foi possível salvar a memória do escritório. Tente novamente.", sucesso: null };
  }

  revalidatePath("/app/perfil");
  return {
    error: null,
    sucesso: "Memória do escritório salva. As próximas respostas e minutas já consideram estas preferências.",
  };
}

/**
 * Inicia o upgrade para o plano Pro (Checkout Session do Stripe). Sempre
 * redireciona ao final (sucesso vai para a `url` do Stripe, erro fica na
 * própria página com o state) — nunca retorna sem redirect ou sem error
 * setado, para o form não ficar "pendurado" sem feedback.
 */
export async function iniciarCheckoutAction(
  _prev: AssinaturaActionState,
  _formData: FormData,
): Promise<AssinaturaActionState> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { error: "Sessão expirada. Faça login novamente." };
  if (usuario.perfil.role !== "owner") {
    return { error: "Só o titular (owner) do escritório pode iniciar uma assinatura." };
  }
  if (usuario.perfil.escritorio.plano === "pro") {
    return { error: "Este escritório já está no plano Pro." };
  }

  const priceId = process.env.STRIPE_PRICE_ID_PRO_MENSAL;
  if (!priceId) return { error: "Billing ainda não configurado neste ambiente." };

  const appUrl = obterAppUrl();
  let url: string;
  try {
    const supabase = await createClient();
    const { data: assinaturaExistente, error: erroAssinaturaExistente } = await supabase
      .from("assinaturas")
      .select("stripe_customer_id")
      .eq("escritorio_id", usuario.perfil.escritorio_id)
      .maybeSingle<Pick<Assinatura, "stripe_customer_id">>();
    if (erroAssinaturaExistente) {
      // Não é fatal para o checkout (segue sem reaproveitar `stripe_customer_id`,
      // Stripe cria um customer novo), mas engolir sem logar escondia
      // problemas reais de schema/RLS na tabela `assinaturas`.
      console.error(
        "[perfil/iniciarCheckoutAction] Falha ao buscar assinatura existente:",
        erroAssinaturaExistente,
      );
    }

    ({ url } = await criarCheckoutSession({
      escritorioId: usuario.perfil.escritorio_id,
      priceId,
      customerEmail: usuario.email ?? "",
      successUrl: `${appUrl}/app/perfil?checkout=sucesso`,
      cancelUrl: `${appUrl}/app/perfil?checkout=cancelado`,
      stripeCustomerId: assinaturaExistente?.stripe_customer_id ?? null,
    }));
  } catch (erro) {
    if (erro instanceof StripeNaoConfiguradoError) return { error: erro.message };
    console.error("[perfil/iniciarCheckoutAction] Falha ao criar checkout session:", erro);
    return { error: "Falha ao iniciar checkout." };
  }

  redirect(url);
}

/** Abre o Customer Portal do Stripe para o escritório já assinante gerenciar cartão/cancelamento. */
export async function abrirPortalAction(
  _prev: AssinaturaActionState,
  _formData: FormData,
): Promise<AssinaturaActionState> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { error: "Sessão expirada. Faça login novamente." };
  if (usuario.perfil.role !== "owner") {
    return { error: "Só o titular (owner) do escritório pode gerenciar a assinatura." };
  }

  const appUrl = obterAppUrl();
  let url: string;
  try {
    const supabase = await createClient();
    const { data: assinatura } = await supabase
      .from("assinaturas")
      .select("stripe_customer_id")
      .eq("escritorio_id", usuario.perfil.escritorio_id)
      .maybeSingle<Pick<Assinatura, "stripe_customer_id">>();

    if (!assinatura?.stripe_customer_id) {
      return { error: "Nenhuma assinatura Stripe encontrada para este escritório." };
    }

    url = await criarPortalSessionUrl(assinatura.stripe_customer_id, `${appUrl}/app/perfil`);
  } catch (erro) {
    if (erro instanceof StripeNaoConfiguradoError) return { error: erro.message };
    console.error("[perfil/abrirPortalAction] Falha ao criar portal session:", erro);
    return { error: "Falha ao abrir portal de assinatura." };
  }

  redirect(url);
}
