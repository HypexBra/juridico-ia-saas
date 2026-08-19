import "server-only";

import Groq from "groq-sdk";
import type { Schema } from "@google/genai";
import { SYSTEM_PROMPT } from "./system-prompt";
import { RAG_TOOLING_PROMPT } from "./rag-prompt";
import { GEMINI_FUNCTION_DECLARATIONS } from "@/lib/rag/tools";
import type { ChatTurno, ChamadaFuncao, RespostaIa } from "./gemini";

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

function getClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY não configurada");
  return new Groq({ apiKey });
}

/**
 * Converte uma `FunctionDeclaration` no formato do Gemini (tipos em
 * MAIÚSCULAS, ex: `Type.OBJECT` = "OBJECT") para JSON Schema padrão OpenAI
 * (tipos em minúsculas), único ajuste estrutural necessário — o restante
 * (properties/required/enum/description) já é compatível entre os dois
 * formatos.
 */
function paraJsonSchemaOpenAi(valor: unknown): unknown {
  if (valor === null || typeof valor !== "object") return valor;
  if (Array.isArray(valor)) return valor.map(paraJsonSchemaOpenAi);

  const objeto = valor as Record<string, unknown>;
  const resultado: Record<string, unknown> = {};
  for (const [chave, item] of Object.entries(objeto)) {
    if (chave === "type" && typeof item === "string") {
      resultado.type = item.toLowerCase();
    } else if (chave === "format" && item === "enum") {
      // "format: enum" é sintaxe específica do Gemini para sinalizar que
      // "enum" abaixo restringe os valores — no JSON Schema padrão o array
      // `enum` já basta, então o campo é descartado (não tem equivalente).
      continue;
    } else {
      resultado[chave] = paraJsonSchemaOpenAi(item);
    }
  }
  return resultado;
}

function montarToolsGroq(): Groq.Chat.Completions.ChatCompletionTool[] {
  return GEMINI_FUNCTION_DECLARATIONS.map((declaracao) => ({
    type: "function",
    function: {
      name: declaracao.name ?? "",
      description: declaracao.description,
      parameters: paraJsonSchemaOpenAi(declaracao.parameters) as Record<string, unknown>,
    },
  }));
}

/**
 * Mesmo contrato de `gerarRespostaGemini` (lib/ia/gemini.ts), servindo como
 * segundo elo da cadeia de fallback. `responseSchema` do Gemini não é
 * reaproveitado 1:1 aqui: os prompts de risco.ts/triagem.ts já descrevem os
 * campos esperados em português no próprio texto do system prompt, então
 * "JSON mode" (`response_format: json_object`) do Groq basta — a validação
 * de verdade continua sendo o `zod.safeParse` já feito pelos callers.
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
  const groq = getClient();
  const ultima = historico[historico.length - 1];
  const anteriores = historico.slice(0, -1);
  const usaSchema = Boolean(opcoes.responseSchema);

  const mensagemFinal = opcoes.contextoRag
    ? `${ultima.conteudo}\n\n${opcoes.contextoRag}`
    : ultima.conteudo;

  const mensagens: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: opcoes.systemPromptOverride ?? `${SYSTEM_PROMPT}\n${RAG_TOOLING_PROMPT}`,
    },
    ...anteriores.map((turno) => ({
      role: (turno.role === "assistant" ? "assistant" : "user") as "assistant" | "user",
      content: turno.conteudo,
    })),
    { role: "user", content: mensagemFinal },
  ];

  const habilitaFerramentas = !usaSchema && Boolean(opcoes.habilitarFerramentas);

  const resposta = await groq.chat.completions.create({
    model: MODELO_GROQ,
    messages: mensagens,
    max_tokens: MAX_OUTPUT_TOKENS_GROQ,
    reasoning_effort: "low",
    tools: habilitaFerramentas ? montarToolsGroq() : undefined,
    response_format: usaSchema ? { type: "json_object" } : undefined,
  });

  const escolha = resposta.choices[0];
  const mensagem = escolha?.message;

  const functionCalls: ChamadaFuncao[] = (mensagem?.tool_calls ?? [])
    .filter((chamada) => chamada.type === "function" && chamada.function?.name)
    .map((chamada) => {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(chamada.function.arguments) as Record<string, unknown>;
      } catch {
        args = {};
      }
      return { name: chamada.function.name, args };
    });

  return {
    texto: mensagem?.content ?? "",
    tokensIn: resposta.usage?.prompt_tokens ?? 0,
    tokensOut: resposta.usage?.completion_tokens ?? 0,
    functionCalls,
  };
}
