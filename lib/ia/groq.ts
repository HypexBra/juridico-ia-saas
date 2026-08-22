import "server-only";

import { ChatGroq } from "@langchain/groq";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { Schema } from "@google/genai";
import { SYSTEM_PROMPT } from "./system-prompt";
import { RAG_TOOLING_PROMPT } from "./rag-prompt";
import { GEMINI_FUNCTION_DECLARATIONS } from "@/lib/rag/tools";
import type { ChatTurno, RespostaIa } from "./gemini";
import { selecionarChave, registrarFalhaQuota } from "@/lib/ia/chaves/pool";
import { QuotaExcedidaError } from "@/lib/ia/erros";
import { paraJsonSchemaOpenAi } from "@/lib/ia/langchain/schema-utils";
import { paraRespostaIa } from "@/lib/ia/langchain/mapeamento";

// Provider de fallback (ver lib/ia/provider.ts para quando ele é acionado).
// "llama-3.3-70b-versatile"/deepseek-r1-distill (avaliados na pesquisa
// inicial) não estão mais disponíveis no catálogo atual da conta Groq
// (confirmado via GET /openai/v1/models real — 404 "model_not_found");
// "openai/gpt-oss-120b" é o modelo mais capaz do catálogo atual, grátis, com
// tool calling nativo e JSON mode testados de verdade (ver scratchpad da
// sessão). É um modelo "reasoning": sem `reasoning_effort: "low"` ele gasta
// o teto inteiro de tokens só pensando e devolve texto vazio — testado e
// confirmado (`completion_tokens` todo em `reasoning_tokens`, `content` "").
const MODELO_GROQ = "openai/gpt-oss-120b";

const MAX_OUTPUT_TOKENS_GROQ = 2048;

function isErroDeQuotaGroq(erro: unknown): boolean {
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  return /429|quota|rate.?limit/i.test(mensagem);
}

/**
 * Client LangChain do Groq (`ChatGroq`) montado com uma chave vinda do pool
 * interno (`lib/ia/chaves/pool.ts`) — permite múltiplas contas/chaves Groq
 * no futuro sob o mesmo mecanismo de rotação/rate-limit do Gemini. Fallback
 * de leitura de `GROQ_API_KEY` (env var fixa) SÓ quando não há nenhuma linha
 * ativa para "groq" na tabela — mesma lógica de transição do Gemini,
 * documentada em .env.example.
 */
async function getClient(): Promise<{ client: ChatGroq; chaveId: string | null } | null> {
  const chave = await selecionarChave("groq");
  if (chave) {
    return { client: new ChatGroq({ apiKey: chave.chavePlana, model: MODELO_GROQ }), chaveId: chave.id };
  }

  const apiKeyEnv = process.env.GROQ_API_KEY;
  if (apiKeyEnv) {
    return { client: new ChatGroq({ apiKey: apiKeyEnv, model: MODELO_GROQ }), chaveId: null };
  }

  return null;
}

function montarToolsGroq() {
  return GEMINI_FUNCTION_DECLARATIONS.map((declaracao) => ({
    type: "function" as const,
    function: {
      name: declaracao.name ?? "",
      description: declaracao.description,
      parameters: paraJsonSchemaOpenAi(declaracao.parameters) as Record<string, unknown>,
    },
  }));
}

/**
 * Mesmo contrato de `gerarRespostaGemini` (lib/ia/gemini.ts), servindo como
 * segundo elo da cadeia de fallback — agora via LangChain (`@langchain/groq`)
 * em vez do `groq-sdk` cru, para reaproveitar a mesma abstração de mensagens/
 * tools do ecossistema LangChain nas próximas integrações. `responseSchema`
 * do Gemini não é reaproveitado 1:1 aqui: os prompts de risco.ts/triagem.ts
 * já descrevem os campos esperados em português no próprio texto do system
 * prompt, então "JSON mode" (`response_format: json_object`) do Groq basta —
 * a validação de verdade continua sendo o `zod.safeParse` já feito pelos
 * callers.
 *
 * Em caso de 429/rate-limit real do Groq, registra a falha no pool
 * (`registrarFalhaQuota`) e lança `QuotaExcedidaError` — `lib/ia/provider.ts`
 * já trata isso quando chamado com `providerOverride: { provider: "groq" }`
 * (sem fallback cross-provider nesse caso, propaga direto).
 */
export async function gerarRespostaGroq(
  historico: ChatTurno[],
  opcoes: {
    contextoRag?: string | null;
    habilitarFerramentas?: boolean;
    systemPromptOverride?: string;
    responseSchema?: Schema;
  } = {},
): Promise<RespostaIa> {
  const cliente = await getClient();
  if (!cliente) {
    throw new QuotaExcedidaError(new Error("Pool de chaves Groq esgotado e GROQ_API_KEY não configurada."));
  }
  const { client, chaveId } = cliente;

  const ultima = historico[historico.length - 1];
  const anteriores = historico.slice(0, -1);
  const usaSchema = Boolean(opcoes.responseSchema);

  const mensagemFinal = opcoes.contextoRag
    ? `${ultima.conteudo}\n\n${opcoes.contextoRag}`
    : ultima.conteudo;

  const mensagens = [
    new SystemMessage(opcoes.systemPromptOverride ?? `${SYSTEM_PROMPT}\n${RAG_TOOLING_PROMPT}`),
    ...anteriores.map((turno) =>
      turno.role === "assistant" ? new AIMessage(turno.conteudo) : new HumanMessage(turno.conteudo),
    ),
    new HumanMessage(mensagemFinal),
  ];

  const habilitaFerramentas = !usaSchema && Boolean(opcoes.habilitarFerramentas);

  try {
    const resposta = await client.invoke(mensagens, {
      max_tokens: MAX_OUTPUT_TOKENS_GROQ,
      reasoning_effort: "low",
      tools: habilitaFerramentas ? montarToolsGroq() : undefined,
      response_format: usaSchema ? { type: "json_object" } : undefined,
    });

    return paraRespostaIa(resposta as AIMessage);
  } catch (erro) {
    if (isErroDeQuotaGroq(erro) && chaveId) {
      const motivo = erro instanceof Error ? erro.message : String(erro);
      await registrarFalhaQuota(chaveId, motivo);
      throw new QuotaExcedidaError(erro);
    }
    throw erro;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STREAMING do provider de fallback — mesmo contrato de
// gerarRespostaGeminiStream (lib/ia/gemini.ts): emite deltas, termina com um
// evento "fim" agregado, e só lança QuotaExcedidaError quando a falha acontece
// ANTES do primeiro token (depois disso não há como reexecutar sem duplicar
// texto já exibido ao usuário).

import type { StreamEvento } from "./gemini";
import { AIMessageChunk } from "@langchain/core/messages";

export async function* gerarRespostaGroqStream(
  historico: ChatTurno[],
  opcoes: {
    contextoRag?: string | null;
    habilitarFerramentas?: boolean;
    systemPromptOverride?: string;
  } = {},
): AsyncGenerator<StreamEvento, void, unknown> {
  const cliente = await getClient();
  if (!cliente) {
    throw new QuotaExcedidaError(new Error("Pool de chaves Groq esgotado e GROQ_API_KEY não configurada."));
  }
  const { client, chaveId } = cliente;

  const ultima = historico[historico.length - 1];
  const anteriores = historico.slice(0, -1);

  const mensagemFinal = opcoes.contextoRag
    ? `${ultima.conteudo}\n\n${opcoes.contextoRag}`
    : ultima.conteudo;

  const mensagens = [
    new SystemMessage(opcoes.systemPromptOverride ?? `${SYSTEM_PROMPT}\n${RAG_TOOLING_PROMPT}`),
    ...anteriores.map((turno) =>
      turno.role === "assistant" ? new AIMessage(turno.conteudo) : new HumanMessage(turno.conteudo),
    ),
    new HumanMessage(mensagemFinal),
  ];

  let stream;
  try {
    stream = await client.stream(mensagens, {
      max_tokens: MAX_OUTPUT_TOKENS_GROQ,
      reasoning_effort: "low",
      tools: opcoes.habilitarFerramentas ? montarToolsGroq() : undefined,
    });
  } catch (erro) {
    if (isErroDeQuotaGroq(erro) && chaveId) {
      await registrarFalhaQuota(chaveId, erro instanceof Error ? erro.message : String(erro));
      throw new QuotaExcedidaError(erro);
    }
    throw erro;
  }

  let textoCompleto = "";
  // Acumula TODOS os chunks do stream num único chunk combinado: os
  // fragmentos de tool call chegam espalhados (`tool_call_chunks`) e só
  // fazem sentido concatenados — o `.concat()` do LangChain junta texto E
  // tool calls na ordem original, sem segunda chamada ao provider.
  let combinado: AIMessageChunk | null = null;
  try {
    for await (const chunk of stream) {
      combinado = combinado ? combinado.concat(chunk) : chunk;
      const pedaco = typeof chunk.content === "string" ? chunk.content : "";
      if (pedaco) {
        textoCompleto += pedaco;
        yield { tipo: "delta", texto: pedaco };
      }
    }
  } catch (erro) {
    if (!textoCompleto && chaveId && isErroDeQuotaGroq(erro)) {
      await registrarFalhaQuota(chaveId, erro instanceof Error ? erro.message : String(erro));
      throw new QuotaExcedidaError(erro);
    }
    yield {
      tipo: "erro",
      mensagem:
        "A resposta foi interrompida no meio da geração. O texto parcial acima foi mantido — reenvie a mensagem para continuar.",
    };
    return;
  }

  // Tool calls completas derivadas dos fragmentos acumulados (vazio quando
  // o modelo respondeu só com texto — caso comum).
  let functionCalls: RespostaIa["functionCalls"] = [];
  if (combinado?.tool_calls?.length) {
    functionCalls = combinado.tool_calls
      .filter((chamada) => Boolean(chamada.name))
      .map((chamada) => ({
        name: chamada.name,
        args: (chamada.args ?? {}) as Record<string, unknown>,
      }));
  }

  yield {
    tipo: "fim",
    resposta: { texto: textoCompleto, tokensIn: 0, tokensOut: 0, functionCalls },
  };
}
