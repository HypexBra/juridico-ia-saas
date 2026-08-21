import type { AIMessage } from "@langchain/core/messages";
import type { ChamadaFuncao, RespostaIa } from "../gemini";

/**
 * Converte a resposta do LangChain (`AIMessage`, o retorno de
 * `ChatGroq#invoke`) para o shape `RespostaIa`/`ChamadaFuncao[]` já usado por
 * `lib/ia/gemini.ts` — nenhum caller (provider.ts, actions.ts) precisa saber
 * se quem respondeu foi o SDK cru do Gemini ou o LangChain do Groq por trás
 * de `gerarRespostaGroq`.
 *
 * `.tool_calls` do LangChain já vem parseado como objeto (diferente do SDK
 * cru da Groq, que devolve `arguments` como string JSON a ser parseada
 * manualmente) — não há `try/catch` de JSON.parse aqui porque o LangChain já
 * fez esse trabalho e falha de parsing interna vira `invalid_tool_calls`,
 * nunca aparece em `.tool_calls`.
 */
export function paraRespostaIa(mensagem: AIMessage): RespostaIa {
  const texto = typeof mensagem.content === "string" ? mensagem.content : extrairTextoDeConteudoComplexo(mensagem.content);

  const functionCalls: ChamadaFuncao[] = (mensagem.tool_calls ?? [])
    .filter((chamada) => Boolean(chamada.name))
    .map((chamada) => ({
      name: chamada.name,
      args: (chamada.args ?? {}) as Record<string, unknown>,
    }));

  const uso = mensagem.usage_metadata;

  return {
    texto,
    tokensIn: uso?.input_tokens ?? 0,
    tokensOut: uso?.output_tokens ?? 0,
    functionCalls,
  };
}

/**
 * `AIMessage.content` do LangChain pode ser `string` ou um array de blocos
 * de conteúdo multimodal (`MessageContentComplex[]`) — o Groq/ChatGroq neste
 * projeto só produz texto (sem imagem/áudio de saída), mas o tipo do
 * LangChain é genérico entre providers; concatena só os blocos de texto para
 * nunca quebrar em runtime caso um formato inesperado apareça.
 */
function extrairTextoDeConteudoComplexo(conteudo: unknown): string {
  if (!Array.isArray(conteudo)) return "";
  return conteudo
    .map((bloco) => {
      if (typeof bloco === "string") return bloco;
      if (bloco && typeof bloco === "object" && "text" in bloco && typeof (bloco as { text: unknown }).text === "string") {
        return (bloco as { text: string }).text;
      }
      return "";
    })
    .join("");
}
