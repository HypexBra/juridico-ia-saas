"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { gerarResposta, type ChatTurno } from "@/lib/ia/gemini";
import { buscarContextoRelevante, montarBlocoContexto } from "@/lib/rag/retrieval";
import { TOOL_PARA_TIPO_PROPOSTA, TOOL_SCHEMAS, type NomeTool } from "@/lib/rag/tools";
import { montarResumoProposta } from "@/lib/rag/resumo-proposta";
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

  // Gate de segurança do agente: só habilita as ferramentas de ação
  // (propose_*) se não houver nenhuma proposta pendente nesta conversa.
  // Evita empilhar múltiplas ações de escrita não confirmadas — o usuário
  // sempre resolve uma de cada vez antes do agente poder propor a próxima.
  const { count: propostasPendentes } = await supabase
    .from("propostas_acao")
    .select("id", { count: "exact", head: true })
    .eq("conversa_id", conversaId)
    .eq("status", "pending");

  // RAG: busca por similaridade na base de conhecimento do escritório
  // (uploads + dados internos já indexados). Falha na busca não derruba o
  // chat — degrada para "sem contexto" e o modelo é instruído a não fingir
  // que consultou uma base (ver RAG_TOOLING_PROMPT).
  let contextoRag: string | null = null;
  try {
    const chunks = await buscarContextoRelevante(supabase, escritorioId, parsed.data.texto);
    contextoRag = montarBlocoContexto(chunks);
  } catch {
    contextoRag = null;
  }

  let respostaIa;
  try {
    respostaIa = await gerarResposta(historico, {
      contextoRag,
      habilitarFerramentas: (propostasPendentes ?? 0) === 0,
    });
  } catch (erro) {
    // Loga a causa real no servidor (ex: "GEMINI_API_KEY não configurada",
    // 404 de nome de modelo inválido, 429 de quota) — a UI sempre mostra só
    // a mensagem amigável abaixo, mas sem este log o operador não tem como
    // diagnosticar qual das duas categorias de falha está ocorrendo.
    console.error("[chat/enviarMensagemAction] Falha ao gerar resposta da IA:", erro);
    return { ok: false, error: "A IA está indisponível no momento. Tente novamente em instantes." };
  }

  const { error: erroInsertUser } = await supabase.from("mensagens").insert({
    escritorio_id: escritorioId,
    conversa_id: conversaId,
    role: "user",
    conteudo: parsed.data.texto,
  });
  if (erroInsertUser) return { ok: false, error: "Não foi possível salvar a mensagem." };

  // Trata no máximo a PRIMEIRA function call retornada: mesmo que o modelo
  // (não confiável) tente propor mais de uma ação na mesma resposta, só uma
  // proposta é criada por turno — reforça o limite de "uma ação por vez".
  let propostaId: string | null = null;
  const chamada = respostaIa.functionCalls[0];
  if (chamada && chamada.name in TOOL_SCHEMAS) {
    const nomeTool = chamada.name as NomeTool;
    const schema = TOOL_SCHEMAS[nomeTool];
    const argsValidados = schema.safeParse(chamada.args);

    if (argsValidados.success) {
      const args = argsValidados.data as Record<string, unknown>;
      const tabelaAlvo =
        nomeTool === "propose_update_prazo" || nomeTool === "propose_create_prazo"
          ? "prazos"
          : nomeTool === "propose_update_ficha" || nomeTool === "propose_create_ficha"
            ? "fichas_caso"
            : null;
      const registroId =
        nomeTool === "propose_update_prazo"
          ? (args.prazo_id as string)
          : nomeTool === "propose_update_ficha"
            ? (args.ficha_id as string)
            : null;

      const { data: novaProposta, error: erroProposta } = await supabase
        .from("propostas_acao")
        .insert({
          escritorio_id: escritorioId,
          conversa_id: conversaId,
          criado_por: perfilId,
          tipo: TOOL_PARA_TIPO_PROPOSTA[nomeTool],
          tabela_alvo: tabelaAlvo,
          registro_id: registroId,
          resumo: montarResumoProposta(nomeTool, args),
          payload: args,
        })
        .select("id")
        .single();

      if (!erroProposta && novaProposta) propostaId = novaProposta.id;
    }
    // Se a validação falhar, a proposta é silenciosamente descartada (o
    // modelo não é confiável por padrão) e o turno segue só com o texto da
    // resposta — nunca criamos uma proposta com dados fora do schema.
  }

  const textoResposta =
    respostaIa.texto ||
    (propostaId
      ? "Preparei uma proposta de ação — revise e aprove ou rejeite no card abaixo."
      : "Não foi possível gerar uma resposta em texto para esta mensagem.");

  const { data: mensagemAssistente, error: erroInsertAssistente } = await supabase
    .from("mensagens")
    .insert({
      escritorio_id: escritorioId,
      conversa_id: conversaId,
      role: "assistant",
      conteudo: textoResposta,
      tokens_in: respostaIa.tokensIn,
      tokens_out: respostaIa.tokensOut,
      proposta_id: propostaId,
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
