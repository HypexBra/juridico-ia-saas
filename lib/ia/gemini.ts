import { GoogleGenerativeAI, type FunctionCall } from "@google/generative-ai";
import { SYSTEM_PROMPT } from "./system-prompt";
import { RAG_TOOLING_PROMPT } from "./rag-prompt";
import { GEMINI_FUNCTION_DECLARATIONS } from "@/lib/rag/tools";

// Roteamento de modelo por complexidade: FLASH cobre a esmagadora maioria das
// perguntas (dúvida pontual, resumo curto); PRO entra só quando o pedido tem
// cara de peça/minuta completa (produção longa e fundamentada, onde a
// qualidade de raciocínio jurídico compensa o custo/latência maior).
const MODELO_FLASH = "gemini-2.0-flash";
const MODELO_PRO = "gemini-2.5-pro";

const PALAVRAS_TAREFA_COMPLEXA =
  /\b(peti[cç][aã]o|minuta|contesta[cç][aã]o|recurso|apela[cç][aã]o|agravo|parecer|contrato completo|embargos)\b/i;

function escolherModelo(ultimaMensagem: string): string {
  if (ultimaMensagem.length > 1500 || PALAVRAS_TAREFA_COMPLEXA.test(ultimaMensagem)) {
    return MODELO_PRO;
  }
  return MODELO_FLASH;
}

const MAX_TENTATIVAS = 3;
const BASE_DELAY_MS = 600;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isErroTransiente(erro: unknown): boolean {
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  return /429|500|502|503|504|rate.?limit|timeout|ECONNRESET|ETIMEDOUT/i.test(mensagem);
}

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada");
  return new GoogleGenerativeAI(apiKey);
}

export type ChatTurno = { role: "user" | "assistant"; conteudo: string };

export type RespostaIa = {
  texto: string;
  tokensIn: number;
  tokensOut: number;
  functionCalls: FunctionCall[];
};

/**
 * Gera a resposta do copiloto. `contextoRag`, quando presente, é anexado
 * como parte final da ÚLTIMA mensagem do usuário (nunca misturado à
 * systemInstruction) — já vem pré-delimitado por
 * lib/rag/retrieval.ts#montarBlocoContexto. `habilitarFerramentas` liga o
 * function-calling nativo do Gemini para as tools propose_* (ver
 * lib/rag/tools.ts); por padrão desligado (ex: geração de análise de ficha
 * não precisa de tools).
 */
export async function gerarResposta(
  historico: ChatTurno[],
  opcoes: { contextoRag?: string | null; habilitarFerramentas?: boolean } = {},
): Promise<RespostaIa> {
  const genAI = getClient();
  const ultima = historico[historico.length - 1];
  const anteriores = historico.slice(0, -1);

  const modeloEscolhido = escolherModelo(ultima.conteudo);
  const model = genAI.getGenerativeModel({
    model: modeloEscolhido,
    systemInstruction: `${SYSTEM_PROMPT}\n${RAG_TOOLING_PROMPT}`,
    tools: opcoes.habilitarFerramentas ? [{ functionDeclarations: GEMINI_FUNCTION_DECLARATIONS }] : undefined,
  });

  const chat = model.startChat({
    history: anteriores.map((turno) => ({
      role: turno.role === "assistant" ? "model" : "user",
      parts: [{ text: turno.conteudo }],
    })),
  });

  const mensagemFinal = opcoes.contextoRag
    ? `${ultima.conteudo}\n\n${opcoes.contextoRag}`
    : ultima.conteudo;

  let ultimoErro: unknown;
  for (let tentativa = 0; tentativa < MAX_TENTATIVAS; tentativa++) {
    try {
      const resultado = await chat.sendMessage(mensagemFinal);
      const resposta = resultado.response;
      const uso = resposta.usageMetadata;

      return {
        texto: resposta.text(),
        tokensIn: uso?.promptTokenCount ?? 0,
        tokensOut: uso?.candidatesTokenCount ?? 0,
        functionCalls: resposta.functionCalls() ?? [],
      };
    } catch (erro) {
      ultimoErro = erro;
      if (!isErroTransiente(erro) || tentativa === MAX_TENTATIVAS - 1) throw erro;
      await delay(BASE_DELAY_MS * 2 ** tentativa);
    }
  }
  throw ultimoErro;
}
