"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { gerarResposta, type ChatTurno } from "@/lib/ia/gemini";
import { LIMITE_MENSAGENS_FREE } from "@/lib/types";
import type { Conversa, Mensagem } from "@/lib/types";

const MAX_HISTORICO = 20;
const MAX_TAMANHO_MENSAGEM = 8000;

function tituloDoTexto(texto: string) {
  const limpo = texto.trim().replace(/\s+/g, " ");
  return limpo.length > 60 ? `${limpo.slice(0, 60)}…` : limpo;
}

async function mesRefAtual() {
  return new Date().toISOString().slice(0, 7);
}

export type ConversaResumo = Pick<Conversa, "id" | "titulo" | "iniciada_em" | "total_msgs">;

export async function listarConversasAction(): Promise<ConversaResumo[]> {
  const usuario = await getUsuarioAtual();
  if (!usuario) throw new Error("Não autenticado.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("conversas")
    .select("id, titulo, iniciada_em, total_msgs")
    .eq("tipo", "interno")
    .order("iniciada_em", { ascending: false })
    .limit(50);

  if (error) throw error;
  return data ?? [];
}

export async function carregarMensagensAction(conversaId: string): Promise<Mensagem[]> {
  const usuario = await getUsuarioAtual();
  if (!usuario) throw new Error("Não autenticado.");

  const parsed = z.string().uuid().safeParse(conversaId);
  if (!parsed.success) throw new Error("Conversa inválida.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mensagens")
    .select("*")
    .eq("conversa_id", parsed.data)
    .order("criado_em", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function contarUsoIaMesAction(): Promise<{ usados: number; limite: number }> {
  const usuario = await getUsuarioAtual();
  if (!usuario) throw new Error("Não autenticado.");

  const supabase = await createClient();
  const { count, error } = await supabase
    .from("uso_ia")
    .select("id", { count: "exact", head: true })
    .eq("mes_ref", await mesRefAtual());

  if (error) throw error;
  return { usados: count ?? 0, limite: LIMITE_MENSAGENS_FREE };
}

const enviarMensagemSchema = z.object({
  conversaId: z.string().uuid().nullable(),
  texto: z.string().trim().min(1, "Digite uma mensagem.").max(MAX_TAMANHO_MENSAGEM, "Mensagem muito longa."),
});

export type EnviarMensagemResultado =
  | { ok: true; conversaId: string; assistente: Mensagem; usoMes: number }
  | { ok: false; error: string };

export async function enviarMensagemAction(
  input: z.infer<typeof enviarMensagemSchema>,
): Promise<EnviarMensagemResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const parsed = enviarMensagemSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { escritorio_id: escritorioId, id: perfilId } = usuario.perfil;
  const supabase = await createClient();
  const mesRef = await mesRefAtual();

  const { count: usoAtual, error: erroUso } = await supabase
    .from("uso_ia")
    .select("id", { count: "exact", head: true })
    .eq("mes_ref", mesRef);
  if (erroUso) return { ok: false, error: "Erro ao verificar uso de IA." };

  if ((usoAtual ?? 0) >= LIMITE_MENSAGENS_FREE) {
    return {
      ok: false,
      error: `Limite mensal de ${LIMITE_MENSAGENS_FREE} mensagens de IA do plano free atingido. Tente novamente no próximo mês.`,
    };
  }

  let conversaIdResolvido = parsed.data.conversaId;

  if (!conversaIdResolvido) {
    const { data: novaConversa, error: erroConversa } = await supabase
      .from("conversas")
      .insert({
        escritorio_id: escritorioId,
        criado_por: perfilId,
        tipo: "interno",
        status: "ativa",
        titulo: tituloDoTexto(parsed.data.texto),
      })
      .select("id")
      .single();
    if (erroConversa || !novaConversa) return { ok: false, error: "Não foi possível iniciar a conversa." };
    conversaIdResolvido = novaConversa.id;
  }

  if (!conversaIdResolvido) {
    return { ok: false, error: "Não foi possível iniciar a conversa." };
  }
  const conversaId: string = conversaIdResolvido;

  // Monta o histórico existente ANTES de persistir a mensagem do usuário, para
  // poder chamar a IA primeiro e só gravar algo no banco se a chamada tiver sucesso
  // (evita deixar a mensagem do usuário órfã, sem resposta, se o Gemini falhar).
  const { data: historicoRows, error: erroHistorico } = await supabase
    .from("mensagens")
    .select("role, conteudo")
    .eq("conversa_id", conversaId)
    .order("criado_em", { ascending: true })
    .limit(MAX_HISTORICO - 1);
  if (erroHistorico) return { ok: false, error: "Não foi possível carregar o histórico." };

  const historico: ChatTurno[] = [
    ...(historicoRows ?? []).map((m) => ({ role: m.role, conteudo: m.conteudo }) as ChatTurno),
    { role: "user", conteudo: parsed.data.texto },
  ];

  let respostaIa;
  try {
    respostaIa = await gerarResposta(historico);
  } catch {
    return { ok: false, error: "A IA está indisponível no momento. Tente novamente em instantes." };
  }

  const { error: erroInsertUser } = await supabase.from("mensagens").insert({
    escritorio_id: escritorioId,
    conversa_id: conversaId,
    role: "user",
    conteudo: parsed.data.texto,
  });
  if (erroInsertUser) return { ok: false, error: "Não foi possível salvar a mensagem." };

  const { data: mensagemAssistente, error: erroInsertAssistente } = await supabase
    .from("mensagens")
    .insert({
      escritorio_id: escritorioId,
      conversa_id: conversaId,
      role: "assistant",
      conteudo: respostaIa.texto,
      tokens_in: respostaIa.tokensIn,
      tokens_out: respostaIa.tokensOut,
    })
    .select("*")
    .single();
  if (erroInsertAssistente || !mensagemAssistente) {
    return { ok: false, error: "A IA respondeu, mas houve um erro ao salvar a resposta." };
  }

  await supabase.from("uso_ia").insert({
    escritorio_id: escritorioId,
    conversa_id: conversaId,
    tokens_in: respostaIa.tokensIn,
    tokens_out: respostaIa.tokensOut,
    mes_ref: mesRef,
  });

  const { count: totalMsgs } = await supabase
    .from("mensagens")
    .select("id", { count: "exact", head: true })
    .eq("conversa_id", conversaId);

  await supabase
    .from("conversas")
    .update({ total_msgs: totalMsgs ?? 0 })
    .eq("id", conversaId);

  revalidatePath("/app/chat");
  revalidatePath("/app/dashboard");
  revalidatePath("/app/financeiro");

  return {
    ok: true,
    conversaId,
    assistente: mensagemAssistente as Mensagem,
    usoMes: (usoAtual ?? 0) + 1,
  };
}
