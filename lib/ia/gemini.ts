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

// Teto explícito de tokens de saída por chamada. Sem isso, o modelo usa o
// limite máximo default (8192 no Flash, 65536 no Pro) em QUALQUER resposta,
// inclusive uma saudação de uma palavra — o teto aqui é só uma rede de
// segurança contra runaway generation; o comportamento normal (resposta
// curta pra "oi", longa pra pedido de peça) já deve vir do SYSTEM_PROMPT
// (ver lib/ia/system-prompt.ts, seção "PROPORCIONALIDADE DA RESPOSTA").
const MAX_OUTPUT_TOKENS_FLASH = 4096;
const MAX_OUTPUT_TOKENS_PRO = 8192;

function escolherModelo(ultimaMensagem: string): string {
  if (ultimaMensagem.length > 1500 || PALAVRAS_TAREFA_COMPLEXA.test(ultimaMensagem)) {
    return MODELO_PRO;
  }
  return MODELO_FLASH;
}

function maxOutputTokensPara(modelo: string): number {
  return modelo === MODELO_PRO ? MAX_OUTPUT_TOKENS_PRO : MAX_OUTPUT_TOKENS_FLASH;
}

const MAX_TENTATIVAS = 3;
const BASE_DELAY_MS = 600;
// 429 aqui é quota/rate-limit da API do Gemini, não uma falha de rede
// pontual: retry rápido em cima de rate-limit só empilha mais chamadas
// contra uma janela de quota já estourada, piorando o problema em vez de
// resolvê-lo. Backoff bem mais longo (mín. 15s) dá tempo da janela de quota
// (tipicamente por minuto) resetar antes da próxima tentativa.
const BASE_DELAY_MS_QUOTA = 15_000;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isErroDeQuota(erro: unknown): boolean {
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  return /429|quota|rate.?limit/i.test(mensagem);
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
    generationConfig: { maxOutputTokens: maxOutputTokensPara(modeloEscolhido) },
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
      const deQuota = isErroDeQuota(erro);
      // 429 de quota: no máximo UMA retentativa (a chamada seguinte já
      // esgotada de novo em <1s não ajuda em nada) e com backoff longo, pra
      // dar chance da janela de rate-limit da API resetar. Demais erros
      // transientes (rede/5xx) mantêm o backoff exponencial curto original.
      if (!isErroTransiente(erro) || tentativa === MAX_TENTATIVAS - 1 || (deQuota && tentativa >= 1)) {
        throw erro;
      }
      await delay(deQuota ? BASE_DELAY_MS_QUOTA : BASE_DELAY_MS * 2 ** tentativa);
    }
  }
  throw ultimoErro;
}
