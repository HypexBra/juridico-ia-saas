"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { gerarResposta, TodosProvidersIndisponiveisError, type ChatTurno } from "@/lib/ia/provider";
import { buscarContextoRelevante, montarBlocoContexto, montarFontesCitaveis, type ChunkRecuperado } from "@/lib/rag/retrieval";
import { validarCitacoes } from "@/lib/rag/citacoes";
import { gerarEmbedding } from "@/lib/rag/embeddings";
import { buscarRespostaCacheada, salvarRespostaCacheSemantico } from "@/lib/rag/cache-semantico";
import { decidirContexto } from "@/lib/ia/roteador-contexto";
import { TOOL_PARA_TIPO_PROPOSTA, TOOL_SCHEMAS, type NomeTool } from "@/lib/rag/tools";
import { montarResumoProposta } from "@/lib/rag/resumo-proposta";
import { limiteMensagensIaPara } from "@/lib/types";
import { blocoContextoEscritorio, carregarMemoriaEscritorio } from "@/lib/ia/contexto-escritorio";
import type { Conversa, Mensagem } from "@/lib/types";
import {
  JANELA_DEDUP_MS,
  MAX_HISTORICO,
  MAX_TAMANHO_MENSAGEM,
  mesRefAtual,
  tituloDoTexto,
  recortarHistoricoPorOrcamento,
  truncarTurnoAntigo,
} from "@/lib/app/chat-shared";
export type ConversaResumo = Pick<Conversa, "id" | "titulo" | "iniciada_em" | "total_msgs" | "criado_por">;

export async function listarConversasAction(): Promise<ConversaResumo[]> {
  const usuario = await getUsuarioAtual();
  if (!usuario) throw new Error("Não autenticado.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("conversas")
    .select("id, titulo, iniciada_em, total_msgs, criado_por")
    .eq("tipo", "interno")
    .order("iniciada_em", { ascending: false })
    .limit(50);

  if (error) throw error;
  return data ?? [];
}

export type ExcluirConversaResultado = { ok: true } | { ok: false; error: string };

/**
 * Exclui uma conversa (e cascata: mensagens, conversas_tags — FKs `on
 * delete cascade`, ver migration 0001). Só o próprio autor pode excluir: a
 * RLS (`conversas_delete_proprio_autor`, migration 0014) já bloqueia no
 * banco, mas checa aqui também pra devolver uma mensagem de erro clara em
 * vez de um "0 rows affected" silencioso.
 *
 * Antes de excluir, DESVINCULA (não apaga) qualquer `fichas_caso` que tenha
 * nascido desta conversa — `fichas_caso.conversa_id` tem `on delete
 * cascade`, e uma ficha de caso carrega prazos/contratos/honorários reais;
 * excluir uma conversa de chat nunca deve arrastar um caso inteiro junto.
 */
export async function excluirConversaAction(conversaId: string): Promise<ExcluirConversaResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Não autenticado." };

  const parsed = z.string().uuid().safeParse(conversaId);
  if (!parsed.success) return { ok: false, error: "Conversa inválida." };

  const supabase = await createClient();

  const { data: conversa, error: erroBusca } = await supabase
    .from("conversas")
    .select("id, criado_por")
    .eq("id", parsed.data)
    .maybeSingle<{ id: string; criado_por: string | null }>();

  if (erroBusca) return { ok: false, error: "Não foi possível localizar a conversa." };
  if (!conversa) return { ok: false, error: "Conversa não encontrada." };
  if (conversa.criado_por !== usuario.perfil.id) {
    return { ok: false, error: "Você só pode excluir conversas criadas por você." };
  }

  const { error: erroDesvincular } = await supabase
    .from("fichas_caso")
    .update({ conversa_id: null })
    .eq("conversa_id", parsed.data);
  if (erroDesvincular) {
    console.error("[chat/excluirConversaAction] Falha ao desvincular fichas_caso:", erroDesvincular);
    return { ok: false, error: "Não foi possível excluir a conversa (falha ao preservar casos vinculados)." };
  }

  const { error: erroExclusao } = await supabase.from("conversas").delete().eq("id", parsed.data);
  if (erroExclusao) {
    console.error("[chat/excluirConversaAction] Falha ao excluir conversa:", erroExclusao);
    return { ok: false, error: "Não foi possível excluir a conversa." };
  }

  return { ok: true };
}

/** Exclui TODAS as conversas do próprio usuário (mesmas regras de excluirConversaAction, em lote). */
export async function excluirTodasConversasAction(): Promise<ExcluirConversaResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Não autenticado." };

  const supabase = await createClient();

  const { data: minhasConversas, error: erroBusca } = await supabase
    .from("conversas")
    .select("id")
    .eq("criado_por", usuario.perfil.id)
    .eq("tipo", "interno")
    .returns<{ id: string }[]>();

  if (erroBusca) return { ok: false, error: "Não foi possível localizar suas conversas." };
  if (!minhasConversas || minhasConversas.length === 0) return { ok: true };

  const ids = minhasConversas.map((c) => c.id);

  const { error: erroDesvincular } = await supabase.from("fichas_caso").update({ conversa_id: null }).in("conversa_id", ids);
  if (erroDesvincular) {
    console.error("[chat/excluirTodasConversasAction] Falha ao desvincular fichas_caso:", erroDesvincular);
    return { ok: false, error: "Não foi possível excluir as conversas (falha ao preservar casos vinculados)." };
  }

  const { error: erroExclusao } = await supabase
    .from("conversas")
    .delete()
    .eq("criado_por", usuario.perfil.id)
    .eq("tipo", "interno");
  if (erroExclusao) {
    console.error("[chat/excluirTodasConversasAction] Falha ao excluir conversas em lote:", erroExclusao);
    return { ok: false, error: "Não foi possível excluir as conversas." };
  }

  return { ok: true };
}

export type ExcluirMensagemResultado = { ok: true } | { ok: false; error: string };

/**
 * Exclui UMA mensagem da conversa (estilo WhatsApp: apaga uma bolha, não a
 * conversa inteira). Mesma regra de posse de `excluirConversaAction` — só
 * quem criou a conversa pode apagar mensagens dela, mesmo apagando uma
 * resposta da IA (a conversa é dele, a resposta só existe porque ele
 * perguntou). Depois de apagar, recalcula `conversas.total_msgs` do mesmo
 * jeito que o envio de mensagem já faz (contagem real, nunca incremento
 * manual — ver final de `enviarMensagemAction`).
 */
export async function excluirMensagemAction(mensagemId: string): Promise<ExcluirMensagemResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Não autenticado." };

  const parsed = z.string().uuid().safeParse(mensagemId);
  if (!parsed.success) return { ok: false, error: "Mensagem inválida." };

  const supabase = await createClient();

  const { data: mensagem, error: erroBusca } = await supabase
    .from("mensagens")
    .select("id, conversa_id")
    .eq("id", parsed.data)
    .maybeSingle<{ id: string; conversa_id: string }>();
  if (erroBusca) return { ok: false, error: "Não foi possível localizar a mensagem." };
  if (!mensagem) return { ok: false, error: "Mensagem não encontrada." };

  const { data: conversa, error: erroConversa } = await supabase
    .from("conversas")
    .select("id, criado_por")
    .eq("id", mensagem.conversa_id)
    .maybeSingle<{ id: string; criado_por: string | null }>();
  if (erroConversa) return { ok: false, error: "Não foi possível localizar a conversa." };
  if (!conversa || conversa.criado_por !== usuario.perfil.id) {
    return { ok: false, error: "Você só pode excluir mensagens de conversas criadas por você." };
  }

  const { error: erroExclusao } = await supabase.from("mensagens").delete().eq("id", parsed.data);
  if (erroExclusao) {
    console.error("[chat/excluirMensagemAction] Falha ao excluir mensagem:", erroExclusao);
    return { ok: false, error: "Não foi possível excluir a mensagem." };
  }

  const { count: totalMsgs } = await supabase
    .from("mensagens")
    .select("id", { count: "exact", head: true })
    .eq("conversa_id", mensagem.conversa_id);

  await supabase.from("conversas").update({ total_msgs: totalMsgs ?? 0 }).eq("id", mensagem.conversa_id);

  revalidatePath("/app/chat");
  return { ok: true };
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
  return { usados: count ?? 0, limite: limiteMensagensIaPara(usuario.perfil.escritorio.plano) };
}

const enviarMensagemSchema = z.object({
  conversaId: z.string().uuid().nullable(),
  texto: z.string().trim().min(1, "Digite uma mensagem.").max(MAX_TAMANHO_MENSAGEM, "Mensagem muito longa."),
  // Switch manual do seletor de provider no chat (components/app/chat-app.tsx):
  // ausente/undefined = "Automático" (fluxo atual Gemini -> fallback Groq);
  // presente = usuário escolheu explicitamente, sem fallback cross-provider.
  provider: z.enum(["gemini", "groq"]).optional(),
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

  const planoEscritorio = usuario.perfil.escritorio.plano;
  const limiteMensagens = limiteMensagensIaPara(planoEscritorio);
  if ((usoAtual ?? 0) >= limiteMensagens) {
    return {
      ok: false,
      error: `Limite mensal de ${limiteMensagens} mensagens de IA do plano ${planoEscritorio} atingido. Tente novamente no próximo mês.`,
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

  // Guard de custo (item 5) + histórico da conversa fundidos numa ÚNICA
  // consulta (antes eram duas queries separadas na mesma tabela `mensagens`
  // — uma p/ dedup, ordenada desc/limit 2, outra p/ histórico, ordenada
  // asc/limit MAX_HISTORICO-1 — cada round trip extra ao Postgres soma
  // latência percebida sem nenhum ganho). Um único SELECT desc/limit
  // MAX_HISTORICO cobre as duas necessidades: os 2 primeiros itens (mais
  // recentes) resolvem o dedup, e o array inteiro revertido vira o
  // histórico cronológico.
  //
  // Bug real corrigido de quebra: a query antiga de histórico usava
  // `ascending: true` + `limit(MAX_HISTORICO - 1)`, o que retorna as
  // MENSAGENS MAIS ANTIGAS da conversa (não as mais recentes) assim que ela
  // passa de ~19 mensagens — o Gemini passava a receber contexto
  // desatualizado (início da conversa) em vez da troca recente, justamente
  // quando o histórico mais importa. Corrigido buscando desc e revertendo.
  const { data: recentesDesc, error: erroHistorico } = await supabase
    .from("mensagens")
    .select("*")
    .eq("conversa_id", conversaId)
    .order("criado_em", { ascending: false })
    .limit(MAX_HISTORICO);
  if (erroHistorico) return { ok: false, error: "Não foi possível carregar o histórico." };

  const recentes = recentesDesc ?? [];
  const [maisRecente, penultima] = recentes;
  if (
    maisRecente &&
    penultima &&
    maisRecente.role === "assistant" &&
    penultima.role === "user" &&
    penultima.conteudo === parsed.data.texto &&
    Date.now() - new Date(penultima.criado_em).getTime() < JANELA_DEDUP_MS
  ) {
    return {
      ok: true,
      conversaId,
      assistente: maisRecente as Mensagem,
      usoMes: usoAtual ?? 0,
    };
  }

  // Monta o histórico existente ANTES de persistir a mensagem do usuário, para
  // poder chamar a IA primeiro e só gravar algo no banco se a chamada tiver sucesso
  // (evita deixar a mensagem do usuário órfã, sem resposta, se o Gemini falhar).
  // `recentes` já vem em ordem desc (mais recente primeiro); reverte para
  // cronológica e mantém só os MAX_HISTORICO - 1 turnos mais recentes (a
  // mensagem atual do usuário ocupa a última posição, adicionada abaixo).
  const historicoRows = [...recentes].reverse().slice(-(MAX_HISTORICO - 1));

  // Mesmos dois cortes da rota de streaming: por TURNO (uma peca gerada nao
  // volta inteira a cada mensagem) e pelo TOTAL da janela (a soma dos turnos
  // nao cresce sem teto conforme a conversa avanca). Ver chat-shared.ts.
  const anteriores = recortarHistoricoPorOrcamento(
    historicoRows.map((m) => truncarTurnoAntigo({ role: m.role, conteudo: m.conteudo } as ChatTurno)),
  );

  const historico: ChatTurno[] = [...anteriores, { role: "user", conteudo: parsed.data.texto }];

  // Roteamento de contexto (lib/ia/roteador-contexto.ts): decide se esta
  // mensagem paga busca RAG e se paga pesquisa web. Antes, a Server Action
  // rodava RAG em TODA mensagem (inclusive "oi") e deixava o provider decidir
  // sozinho sobre a pesquisa · agora as duas decisoes saem do mesmo lugar
  // que a rota de streaming usa, para os dois caminhos nao divergirem.
  const contexto = decidirContexto(parsed.data.texto);

  // Caching semântico (Fase 3 do plano RAG): só para perguntas classificadas
  // como conhecimento geral — `modo === 'interno'` já significa "não depende
  // de RAG nem de pesquisa web" (ver roteador-contexto.ts). Um HIT evita a
  // chamada de LLM inteira. Nunca aplicado com `providerOverride`: o usuário
  // escolheu explicitamente um provider, servir um cache gravado por outro
  // seria surpreendente. Falha no embedding/RPC é fail-open (segue pro fluxo
  // normal) — ver lib/rag/cache-semantico.ts.
  let embeddingConsultaCache: number[] | null = null;
  if (contexto.modo === "interno" && !parsed.data.provider) {
    try {
      embeddingConsultaCache = await gerarEmbedding(parsed.data.texto, "RETRIEVAL_QUERY");
      const cacheado = await buscarRespostaCacheada(supabase, escritorioId, embeddingConsultaCache);
      if (cacheado) {
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
            conteudo: cacheado.resposta,
            tokens_in: 0,
            tokens_out: 0,
            fontes: null,
          })
          .select("*")
          .single();
        if (erroInsertAssistente || !mensagemAssistente) {
          return { ok: false, error: "A IA respondeu, mas houve um erro ao salvar a resposta." };
        }

        await supabase.from("uso_ia").insert({
          escritorio_id: escritorioId,
          conversa_id: conversaId,
          tokens_in: 0,
          tokens_out: 0,
          mes_ref: mesRef,
          origem: "chat_cache_semantico",
          duracao_ms: 0,
          modelo: cacheado.modelo,
        });

        const { count: totalMsgsCache } = await supabase
          .from("mensagens")
          .select("id", { count: "exact", head: true })
          .eq("conversa_id", conversaId);
        await supabase.from("conversas").update({ total_msgs: totalMsgsCache ?? 0 }).eq("id", conversaId);

        revalidatePath("/app/chat");
        revalidatePath("/app/dashboard");
        revalidatePath("/app/financeiro");

        return {
          ok: true,
          conversaId,
          assistente: mensagemAssistente as Mensagem,
          usoMes: usoAtual ?? 0,
        };
      }
    } catch (erro) {
      console.error("[chat/enviarMensagemAction] Falha no cache semântico; seguindo sem cache:", erro);
    }
  }

  // Gate de segurança do agente (query de propostas pendentes), busca RAG e
  // memória do escritório (Fase 17) são independentes entre si (não
  // compartilham dado nenhum) e todas precisam terminar antes de chamar a IA
  // — antes rodavam em sequência (uma espera a outra à toa). Disparadas em
  // paralelo: a latência total passa a ser o MAIOR dos tempos, não a SOMA.
  // RAG usa `.catch` (não `all`) porque falha na busca já é um caso esperado
  // e tratado como "sem contexto", nunca deve derrubar o turno inteiro; a
  // memória é fail-safe por construção (carregarMemoriaEscritorio devolve
  // defaults em qualquer erro).
  const [propostasPendentesResultado, ragResultado, memoriaEscritorio] = await Promise.all([
    supabase
      .from("propostas_acao")
      .select("id", { count: "exact", head: true })
      .eq("conversa_id", conversaId)
      .eq("status", "pending"),
    contexto.usarRag
      ? buscarContextoRelevante(supabase, escritorioId, parsed.data.texto).catch(() => [] as ChunkRecuperado[])
      : Promise.resolve([] as ChunkRecuperado[]),
    carregarMemoriaEscritorio(supabase, escritorioId),
  ]);

  const propostasPendentes = propostasPendentesResultado.count;

  // RAG: busca por similaridade na base de conhecimento do escritório
  // (uploads + dados internos já indexados). Falha na busca não derruba o
  // chat — degrada para "sem contexto" e o modelo é instruído a não fingir
  // que consultou uma base (ver RAG_TOOLING_PROMPT).
  const chunksRag: ChunkRecuperado[] = ragResultado;
  const contextoRag: string | null = montarBlocoContexto(chunksRag);
  // Memória do escritório (Fase 17): bloco delimitado/truncado ou "" quando
  // o escritório não configurou nada — undefined mantém o comportamento
  // idêntico ao anterior à fase dentro de comporSystemInstruction.
  const blocoMemoria = blocoContextoEscritorio(memoriaEscritorio);

  const inicioGeracaoMs = Date.now();
  let respostaIa;
  try {
    respostaIa = await gerarResposta(historico, {
      contextoRag,
      modoContexto: contexto.modo,
      habilitarFerramentas: (propostasPendentes ?? 0) === 0,
      blocoMemoriaEscritorio: blocoMemoria || undefined,
      providerOverride: parsed.data.provider ? { provider: parsed.data.provider } : undefined,
    });
  } catch (erro) {
    if (erro instanceof TodosProvidersIndisponiveisError) {
      // Log estruturado DISTINTO do genérico abaixo — diferencia
      // esgotamento real do pool de chaves (ambos os providers sem cota)
      // de erro de configuração (ex: env var faltando), que antes ficavam
      // indistinguíveis porque só o erro (mascarado) do Groq era logado.
      console.error(
        JSON.stringify({
          evento: "pool_llm_esgotado",
          causaGemini: erro.causaGemini instanceof Error ? erro.causaGemini.message : String(erro.causaGemini),
          causaGroq: erro.causaGroq instanceof Error ? erro.causaGroq.message : String(erro.causaGroq),
          timestamp: new Date().toISOString(),
        }),
      );
      return { ok: false, error: "A IA está indisponível no momento. Tente novamente em instantes." };
    }

    // Loga a causa real no servidor (ex: "GEMINI_API_KEY não configurada",
    // 404 de nome de modelo inválido, 429 de quota) — a UI sempre mostra só
    // a mensagem amigável abaixo, mas sem este log o operador não tem como
    // diagnosticar qual das duas categorias de falha está ocorrendo.
    console.error("[chat/enviarMensagemAction] Falha ao gerar resposta da IA:", erro);
    return { ok: false, error: "A IA está indisponível no momento. Tente novamente em instantes." };
  }
  const duracaoGeracaoMs = Date.now() - inicioGeracaoMs;

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
  if (chamada?.name && chamada.name in TOOL_SCHEMAS) {
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

  // Checagem determinística (sem chamada de IA) das citações "[Doc #N]" que o
  // modelo colocou no texto contra o total de chunks de fato injetados no
  // prompt — nunca bloqueia a resposta (o texto já está pronto), só dá
  // visibilidade em log quando o modelo referencia um doc que não existe.
  const { invalidas: citacoesInvalidas } = validarCitacoes(textoResposta, chunksRag.length);
  if (citacoesInvalidas.length > 0) {
    console.error(
      JSON.stringify({
        evento: "rag_citacao_invalida",
        conversaId,
        totalChunks: chunksRag.length,
        citacoesInvalidas,
      }),
    );
  }

  // Grava no cache semântico (best-effort, nunca bloqueia) só quando: a
  // pergunta já tinha sido classificada como conhecimento geral (o mesmo
  // `embeddingConsultaCache` calculado acima pro lookup), a resposta é texto
  // de verdade (não function call) e nenhuma proposta de ação foi criada —
  // uma proposta é específica do turno, memoizar isso não faz sentido.
  if (embeddingConsultaCache && !propostaId && respostaIa.texto) {
    void salvarRespostaCacheSemantico(supabase, {
      escritorioId,
      pergunta: parsed.data.texto,
      embeddingConsulta: embeddingConsultaCache,
      resposta: textoResposta,
      tokensIn: respostaIa.tokensIn,
      tokensOut: respostaIa.tokensOut,
      modelo: respostaIa.modelo ?? null,
    });
  }

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
      fontes: chunksRag.length > 0 ? montarFontesCitaveis(chunksRag) : null,
    })
    .select("*")
    .single();
  if (erroInsertAssistente || !mensagemAssistente) {
    return { ok: false, error: "A IA respondeu, mas houve um erro ao salvar a resposta." };
  }

  // Observabilidade (Fase 27): origem fixa "chat", duração da geração em ms
  // e o modelo que DE FATO respondeu (Gemini escolhido/fallback de quota ou
  // Groq — ver RespostaIa.modelo).
  await supabase.from("uso_ia").insert({
    escritorio_id: escritorioId,
    conversa_id: conversaId,
    tokens_in: respostaIa.tokensIn,
    tokens_out: respostaIa.tokensOut,
    mes_ref: mesRef,
    origem: "chat",
    duracao_ms: duracaoGeracaoMs,
    modelo: respostaIa.modelo ?? null,
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
