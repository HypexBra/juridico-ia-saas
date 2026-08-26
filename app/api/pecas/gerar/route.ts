import { NextRequest } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { planoTemAcesso } from "@/lib/planos/gating";
import { gerarRespostaStream, TodosProvidersIndisponiveisError, type RespostaIa } from "@/lib/ia/provider";
import { carregarDadosFichaParaPeca } from "@/lib/pecas/carregar-dados-ficha";
import { montarPromptPeca } from "@/lib/pecas/prompt";
import { ehTipoPecaValido } from "@/lib/pecas/tipos";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const gerarPecaSchema = z.object({
  fichaId: z.string().uuid("Ficha inválida."),
  tipoPeca: z.string().min(1, "Informe o tipo de peça."),
  instrucoesExtras: z.string().max(4000, "Instruções extras muito longas.").optional().default(""),
});

/**
 * Rota de STREAMING da redação assistida de peças completas (SSE) —
 * substitui `gerarPecaCompletaAction` (Server Action one-shot em
 * `app/app/fichas/[id]/pecas-actions.ts`, agora removida) pelo MESMO
 * transporte já validado no chat (`app/api/chat/mensagem/route.ts`): a
 * minuta aparece conforme é gerada em vez do usuário ver "Gerando peça
 * completa…" parado por 15-40s (peças roteiam para o modelo com teto de
 * saída/thinking maior — ver `escolherModelo` em lib/ia/gemini.ts).
 *
 * Pipeline de negócio idêntico ao one-shot anterior: gate de plano Pro
 * ANTES de qualquer I/O, busca da ficha (+ prazo/contrato mais recentes) via
 * `carregarDadosFichaParaPeca`, montagem do prompt via `montarPromptPeca`.
 * Mudou só a ENTREGA (deltas via SSE) e o MOMENTO da persistência (ao final
 * do stream, dentro desta rota — nunca do lado do cliente).
 *
 * Protocolo SSE (eventos JSON por linha `data:`):
 *   {"tipo":"delta","texto":...}                          — pedaço da peça
 *   {"tipo":"done","conteudoGerado":...,"modeloIaUsado":...} — fim OK, já persistido
 *   {"tipo":"error","error":...}                          — falha (antes ou durante a geração)
 *
 * Interrupção mid-stream (rede cai, quota estoura no meio): diferente do
 * chat, aqui NÃO persistimos o texto parcial em `pecas_geradas` — uma peça
 * processual pela metade salva como "peça gerada" é um risco de compliance
 * maior do que perder uma mensagem de chat parcial (o auditor de peças/
 * histórico do escritório não pode conter uma "petição inicial" cortada no
 * meio sem qualquer marcação). O texto parcial já entregue via deltas
 * continua visível no client (ver redacao-assistida-card.tsx), só não é
 * gravado como registro oficial gerado.
 */
export async function POST(request: NextRequest) {
  const usuario = await getUsuarioAtual();
  if (!usuario) {
    return new Response(JSON.stringify({ tipo: "error", error: "Sessão expirada. Faça login novamente." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!planoTemAcesso(usuario.perfil.escritorio, "redacao_assistida_pecas")) {
    return new Response(
      JSON.stringify({ tipo: "error", error: "Redação assistida de peças completas é um recurso do plano Pro." }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
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

  const parsed = gerarPecaSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ tipo: "error", error: parsed.error.issues[0]?.message ?? "Dados inválidos." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
  const input = parsed.data;

  if (!ehTipoPecaValido(input.tipoPeca)) {
    return new Response(JSON.stringify({ tipo: "error", error: "Tipo de peça inválido." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const tipoPeca = input.tipoPeca;
  const instrucoesExtras = input.instrucoesExtras.trim() || null;

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enviar = (objeto: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(objeto)}\n\n`));
      };

      try {
        const supabase = await createClient();

        // Gate de ownership: `carregarDadosFichaParaPeca` só consegue ler a
        // ficha se ela pertencer (via RLS) ao escritório da sessão do
        // usuário autenticado — mesma garantia que a Server Action tinha
        // (nenhum filtro explícito por escritorio_id era feito lá também;
        // dependia da mesma política de RLS de `fichas_caso`).
        const resultadoFicha = await carregarDadosFichaParaPeca(supabase, input.fichaId);
        if (!resultadoFicha.ok) {
          enviar({ tipo: "error", error: resultadoFicha.error });
          return;
        }
        const dadosFicha = resultadoFicha.dados;

        const prompt = montarPromptPeca({ tipoPeca, ficha: dadosFicha, instrucoesExtras });

        let textoAcumulado = "";
        let respostaFinal: RespostaIa | null = null;
        let streamInterrompido = false;
        const inicioGeracaoMs = Date.now();

        try {
          for await (const evento of gerarRespostaStream([{ role: "user", conteudo: prompt }], {
            habilitarFerramentas: false,
          })) {
            if (evento.tipo === "delta") {
              textoAcumulado += evento.texto;
              enviar({ tipo: "delta", texto: evento.texto });
            } else if (evento.tipo === "fim") {
              respostaFinal = evento.resposta;
            } else if (evento.tipo === "erro") {
              streamInterrompido = true;
              break;
            }
          }
        } catch (erro) {
          if (erro instanceof TodosProvidersIndisponiveisError) {
            console.error(
              JSON.stringify({
                evento: "pool_llm_esgotado",
                origem: "redacao_peca",
                causaGemini: erro.causaGemini instanceof Error ? erro.causaGemini.message : String(erro.causaGemini),
                causaGroq: erro.causaGroq instanceof Error ? erro.causaGroq.message : String(erro.causaGroq),
                timestamp: new Date().toISOString(),
              }),
            );
          } else {
            console.error("[api/pecas/gerar] Falha ao gerar peça via IA:", erro, {
              fichaId: input.fichaId,
              tipoPeca,
            });
          }
          streamInterrompido = true;
        }

        const duracaoGeracaoMs = Date.now() - inicioGeracaoMs;

        if (streamInterrompido || !respostaFinal) {
          // Mid-stream ou falha antes do primeiro token: nunca grava uma
          // peça incompleta como se fosse o registro oficial gerado (ver
          // comentário no topo do arquivo). Texto parcial some da tela ao
          // usuário retentar — comportamento aceitável para uma peça
          // jurídica (ao contrário de uma mensagem de chat).
          enviar({
            tipo: "error",
            error: textoAcumulado
              ? "A geração foi interrompida antes de concluir a peça. Tente novamente."
              : "A IA está indisponível no momento. Tente novamente em instantes.",
          });
          return;
        }

        if (!respostaFinal.texto.trim()) {
          enviar({ tipo: "error", error: "A IA não conseguiu gerar a peça. Tente novamente ou ajuste as instruções." });
          return;
        }

        // Nome do modelo de fato usado não é informado por `RespostaIa` hoje
        // (o fallback Gemini->Groq é transparente — ver lib/ia/provider.ts):
        // mesma honestidade documentada no antigo fluxo one-shot.
        const modeloIaUsado = "gemini-flash-latest (fallback: groq)";

        const { error: erroInsercao } = await supabase.from("pecas_geradas").insert({
          escritorio_id: usuario.perfil.escritorio_id,
          ficha_caso_id: input.fichaId,
          tipo_peca: tipoPeca,
          instrucoes_extras: instrucoesExtras,
          conteudo_gerado: respostaFinal.texto,
          modelo_ia_usado: modeloIaUsado,
          criado_por: usuario.perfil.id,
        });

        if (erroInsercao) {
          console.error("[api/pecas/gerar] Falha ao registrar peça gerada:", erroInsercao, {
            fichaId: input.fichaId,
            tipoPeca,
          });
          enviar({
            tipo: "error",
            error: "A peça foi gerada, mas houve um erro ao registrar a auditoria. Tente novamente.",
          });
          return;
        }

        await supabase.from("uso_ia").insert({
          escritorio_id: usuario.perfil.escritorio_id,
          tokens_in: respostaFinal.tokensIn,
          tokens_out: respostaFinal.tokensOut,
          duracao_ms: duracaoGeracaoMs,
          origem: "redacao_peca",
          mes_ref: new Date().toISOString().slice(0, 7),
        });

        revalidatePath(`/app/fichas/${input.fichaId}`);

        enviar({
          tipo: "done",
          conteudoGerado: respostaFinal.texto,
          modeloIaUsado,
        });
      } catch (erro) {
        console.error("[api/pecas/gerar] Erro inesperado:", erro);
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
