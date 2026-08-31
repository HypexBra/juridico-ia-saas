import { NextRequest } from "next/server";
import { z } from "zod";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import {
  gerarRespostaStream,
  TodosProvidersIndisponiveisError,
  type ChatTurno,
  type RespostaIa,
} from "@/lib/ia/provider";
import {
  buscarContextoRelevante,
  montarBlocoContexto,
  montarFontesCitaveis,
  type ChunkRecuperado,
} from "@/lib/rag/retrieval";
import { TOOL_PARA_TIPO_PROPOSTA, TOOL_SCHEMAS, type NomeTool } from "@/lib/rag/tools";
import { validarCitacoes } from "@/lib/rag/citacoes";
import { montarResumoProposta } from "@/lib/rag/resumo-proposta";
import { limiteMensagensIaPara, type Mensagem } from "@/lib/types";
import { decidirContexto } from "@/lib/ia/roteador-contexto";
import { blocoContextoEscritorio, carregarMemoriaEscritorio } from "@/lib/ia/contexto-escritorio";
import {
  JANELA_DEDUP_MS,
  MAX_HISTORICO,
  MAX_TAMANHO_MENSAGEM,
  mesRefAtual,
  recortarHistoricoPorOrcamento,
  tituloDoTexto,
  truncarTurnoAntigo,
} from "@/lib/app/chat-shared";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const enviarMensagemSchema = z.object({
  conversaId: z.string().uuid().nullable(),
  texto: z.string().trim().min(1, "Digite uma mensagem.").max(MAX_TAMANHO_MENSAGEM, "Mensagem muito longa."),
  // Switch manual do seletor de provider no chat: ausente/undefined =
  // "Automático" (fluxo atual Gemini -> fallback Groq); presente = usuário
  // escolheu explicitamente, sem fallback cross-provider.
  provider: z.enum(["gemini", "groq"]).optional(),
});

/**
 * Rota de STREAMING do chat (SSE) — substitui o fluxo one-shot da Server
 * Action para a resposta aparecer conforme é gerada. O pipeline de negócio é
 * IDÊNTICO ao de `enviarMensagemAction` (mesma validação, mesma checagem de
 * quota mensal, mesmo dedup, mesmo RAG, mesma criação de propostas via
 * function call) — mudou apenas a ENTREGA: deltas de texto fluem pelo stream.
 *
 * Protocolo SSE (eventos JSON por linha `data:`):
 *   {"tipo":"meta","conversaId":...}   — logo no início (conversa pode ter sido criada agora)
 *   {"tipo":"delta","texto":...}       — pedaço da resposta
 *   {"tipo":"done", ...}               — fim OK: ids persistidos, uso mensal, proposta criada?
 *   {"tipo":"error","error":...}       — falha (antes ou durante a geração)
 *
 * Modo rápido (mensagens triviais — "oi"): pula busca RAG E grounding de
 * pesquisa web; primeiro token sai em ~1s em vez de ~5-10s.
 */
export async function POST(request: NextRequest) {
  const usuario = await getUsuarioAtual();
  if (!usuario) {
    return new Response(JSON.stringify({ tipo: "error", error: "Sessão expirada. Faça login novamente." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ tipo: "error", error: "Corpo inválido." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = enviarMensagemSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ tipo: "error", error: parsed.error.issues[0]?.message ?? "Dados inválidos." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
  const input = parsed.data;

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enviar = (objeto: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(objeto)}\n\n`));
      };

      try {
        const { escritorio_id: escritorioId, id: perfilId } = usuario.perfil;
        const supabase = await createClient();
        const mesRef = await mesRefAtual();

        // Quota mensal do plano (mesma regra do fluxo one-shot).
        const { count: usoAtual, error: erroUso } = await supabase
          .from("uso_ia")
          .select("id", { count: "exact", head: true })
          .eq("mes_ref", mesRef);
        if (erroUso) throw new Error("Erro ao verificar uso de IA.");

        const planoEscritorio = usuario.perfil.escritorio.plano;
        const limiteMensagens = limiteMensagensIaPara(planoEscritorio);
        if ((usoAtual ?? 0) >= limiteMensagens) {
          enviar({
            tipo: "error",
            error: `Limite mensal de ${limiteMensagens} mensagens de IA do plano ${planoEscritorio} atingido. Tente novamente no próximo mês.`,
            codigo: "limite_atingido",
          });
          return;
        }

        // Cria conversa se necessário (antes do primeiro evento pro cliente).
        let conversaId = input.conversaId;
        if (!conversaId) {
          const { data: novaConversa, error: erroConversa } = await supabase
            .from("conversas")
            .insert({
              escritorio_id: escritorioId,
              criado_por: perfilId,
              tipo: "interno",
              status: "ativa",
              titulo: tituloDoTexto(input.texto),
            })
            .select("id")
            .single();
          if (erroConversa || !novaConversa) throw new Error("Não foi possível iniciar a conversa.");
          conversaId = novaConversa.id;
        }
        enviar({ tipo: "meta", conversaId });

        // Histórico + dedup numa única consulta desc (ver chat-shared.ts).
        const { data: recentesDesc, error: erroHistorico } = await supabase
          .from("mensagens")
          .select("*")
          .eq("conversa_id", conversaId)
          .order("criado_em", { ascending: false })
          .limit(MAX_HISTORICO);
        if (erroHistorico) throw new Error("Não foi possível carregar o histórico.");

        const recentes = recentesDesc ?? [];
        const [maisRecente, penultima] = recentes;
        if (
          maisRecente &&
          penultima &&
          maisRecente.role === "assistant" &&
          penultima.role === "user" &&
          penultima.conteudo === input.texto &&
          Date.now() - new Date(penultima.criado_em).getTime() < JANELA_DEDUP_MS
        ) {
          enviar({
            tipo: "done",
            conversaId,
            mensagem: maisRecente as Mensagem,
            usoMes: usoAtual ?? 0,
            deduplicada: true,
          });
          return;
        }

        const historicoRows = [...recentes].reverse().slice(-(MAX_HISTORICO - 1));
        // Dois cortes complementares: por TURNO (uma peca gerada nao volta
        // inteira) e pelo TOTAL (a soma dos turnos nao cresce sem teto ao
        // longo da conversa). Ver chat-shared.ts.
        const anteriores = recortarHistoricoPorOrcamento(
          historicoRows.map((m) => truncarTurnoAntigo({ role: m.role, conteudo: m.conteudo } as ChatTurno)),
        );
        const historico: ChatTurno[] = [...anteriores, { role: "user", conteudo: input.texto }];

        // Roteamento de contexto ANTES de qualquer chamada cara (ver
        // lib/ia/roteador-contexto.ts). Decide, de uma vez, se esta mensagem
        // paga busca no banco (RAG) e se paga pesquisa web (grounding
        // server-side, de segundos). Antes so havia trivial/nao-trivial, e
        // toda mensagem nao-trivial pagava as duas coisas.
        const contexto = decidirContexto(input.texto);
        const trivial = contexto.modo === "rapido";

        // Três consultas INDEPENDENTES em paralelo (a latência total é o
        // maior dos três tempos, não a soma): propostas pendentes (gate do
        // agente), RAG e memória do escritório (Fase 17). A memória é
        // fail-safe por construção — carregarMemoriaEscritorio nunca lança
        // (qualquer erro devolve defaults), então é segura aqui dentro.
        const [propostasPendentesResultado, ragResultado, memoriaEscritorio] = await Promise.all([
          supabase
            .from("propostas_acao")
            .select("id", { count: "exact", head: true })
            .eq("conversa_id", conversaId)
            .eq("status", "pending"),
          contexto.usarRag
            ? buscarContextoRelevante(supabase, escritorioId, input.texto).catch(() => [] as ChunkRecuperado[])
            : Promise.resolve([] as ChunkRecuperado[]),
          carregarMemoriaEscritorio(supabase, escritorioId),
        ]);

        const propostasPendentes = propostasPendentesResultado.count;
        const contextoRag: string | null = contexto.usarRag ? montarBlocoContexto(ragResultado) : null;
        // Bloco vazio (escritório sem memória configurada) vira undefined:
        // comporSystemInstruction trata os dois como "nada a injetar" —
        // comportamento idêntico ao anterior à Fase 17.
        const blocoMemoria = blocoContextoEscritorio(memoriaEscritorio);

        // ── Geração streaming com fallback cross-provider ──
        let textoAcumulado = "";
        let respostaFinal: RespostaIa | null = null;
        let streamInterrompido = false;
        const inicioGeracaoMs = Date.now();
        let duracaoGeracaoMs = 0;

        try {
          for await (const evento of gerarRespostaStream(historico, {
            contextoRag,
            habilitarFerramentas: (propostasPendentes ?? 0) === 0,
            modoRapido: trivial,
            modoContexto: contexto.modo,
            blocoMemoriaEscritorio: blocoMemoria || undefined,
            providerOverride: input.provider ? { provider: input.provider } : undefined,
          })) {
            if (evento.tipo === "delta") {
              textoAcumulado += evento.texto;
              enviar({ tipo: "delta", texto: evento.texto });
            } else if (evento.tipo === "fim") {
              respostaFinal = evento.resposta;
            } else if (evento.tipo === "erro") {
              // Mid-stream: texto parcial já foi entregue ao cliente. Marcamos
              // interrupção e seguimos para persistir o parcial (melhor que
              // perder tudo) — sem fingir que a resposta está completa.
              streamInterrompido = true;
              break;
            }
          }
        } catch (erro) {
          if (erro instanceof TodosProvidersIndisponiveisError) {
            console.error(
              JSON.stringify({
                evento: "pool_llm_esgotado",
                causaGemini: erro.causaGemini instanceof Error ? erro.causaGemini.message : String(erro.causaGemini),
                causaGroq: erro.causaGroq instanceof Error ? erro.causaGroq.message : String(erro.causaGroq),
                timestamp: new Date().toISOString(),
              }),
            );
          } else {
            console.error("[chat/stream] Falha ao gerar resposta da IA:", erro);
          }
          if (!textoAcumulado) {
            enviar({
              tipo: "error",
              error: "A IA está indisponível no momento. Tente novamente em instantes.",
            });
            return;
          }
          // Com texto parcial entregue: cai no tratamento de interrupção abaixo.
        }
        // Duração da geração (sucesso OU interrupção mid-stream): cobre o
        // tempo total do for-await, incluindo fallback cross-provider se
        // houve. Só é registrada quando o fluxo chega ao persistir.
        duracaoGeracaoMs = Date.now() - inicioGeracaoMs;

        if (!respostaFinal && !textoAcumulado) {
          enviar({ tipo: "error", error: "A IA está indisponível no momento. Tente novamente em instantes." });
          return;
        }

        const interrompida = !respostaFinal || streamInterrompido;
        const tokensIn = respostaFinal?.tokensIn ?? 0;
        const tokensOut = respostaFinal?.tokensOut ?? 0;
        const functionCalls = respostaFinal?.functionCalls ?? [];
        const texto =
          (respostaFinal?.texto || textoAcumulado) ||
          (functionCalls.length > 0
            ? "Preparei uma proposta de ação — revise e aprove ou rejeite no card abaixo."
            : "Não foi possível gerar uma resposta em texto para esta mensagem.");

        // Persistência idêntica ao fluxo one-shot: user primeiro, depois
        // assistant (o cliente já mostra ambos otimisticamente).
        const { error: erroInsertUser } = await supabase.from("mensagens").insert({
          escritorio_id: escritorioId,
          conversa_id: conversaId,
          role: "user",
          conteudo: input.texto,
        });
        if (erroInsertUser) throw new Error("Não foi possível salvar a mensagem.");

        // Proposta via function call (no máximo a primeira — uma ação por vez).
        let propostaId: string | null = null;
        const chamada = functionCalls[0];
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
        }

        // Registro de uso mensal + mensagem do assistente (mesmos campos do
        // fluxo one-shot: tokens, proposta vinculada e fontes RAG citáveis).
        // Observabilidade (Fase 27): origem fixa "chat", duração da geração
        // em ms e o modelo que DE FATO respondeu (pode ter sido o fallback
        // de quota ou o Groq — ver RespostaIa.modelo); null quando a resposta
        // veio interrompida sem agregado final.
        await supabase.from("uso_ia").insert({
          escritorio_id: escritorioId,
          conversa_id: conversaId,
          tokens_in: tokensIn,
          tokens_out: tokensOut,
          mes_ref: mesRef,
          origem: "chat",
          duracao_ms: duracaoGeracaoMs,
          modelo: respostaFinal?.modelo ?? null,
        });
        const { data: msgAssistant, error: erroInsertAssistant } = await supabase
          .from("mensagens")
          .insert({
            escritorio_id: escritorioId,
            conversa_id: conversaId,
            role: "assistant",
            conteudo: texto,
            tokens_in: tokensIn,
            tokens_out: tokensOut,
            proposta_id: propostaId,
            fontes: !trivial && ragResultado.length > 0 ? montarFontesCitaveis(ragResultado) : null,
          })
          .select("*")
          .single();

        if (erroInsertAssistant || !msgAssistant) throw new Error("Não foi possível salvar a resposta.");

        // Mesma checagem determinística de citação do fluxo one-shot (ver
        // app/app/chat/actions.ts) — aqui contra `ragResultado`, o RAG desta
        // mesma requisição.
        const { invalidas: citacoesInvalidas } = validarCitacoes(texto, trivial ? 0 : ragResultado.length);
        if (citacoesInvalidas.length > 0) {
          console.error(
            JSON.stringify({
              evento: "rag_citacao_invalida",
              conversaId,
              totalChunks: trivial ? 0 : ragResultado.length,
              citacoesInvalidas,
            }),
          );
        }

        if (interrompida) {
          console.error(
            JSON.stringify({
              evento: "stream_interrompido_midway",
              conversaId,
              charsParciais: texto.length,
              timestamp: new Date().toISOString(),
            }),
          );
        }

        enviar({
          tipo: "done",
          conversaId,
          mensagem: msgAssistant as Mensagem,
          usoMes: (usoAtual ?? 0) + 1,
          propostaId,
          tokensIn,
          tokensOut,
          modoRapido: trivial,
          modoContexto: contexto.modo,
          interrompida,
        });
      } catch (erro) {
        console.error("[chat/stream] Erro inesperado:", erro);
        enviar({ tipo: "error", error: erro instanceof Error ? erro.message : "Erro interno." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
