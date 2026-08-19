import { GoogleGenAI, type Schema } from "@google/genai";
import { SYSTEM_PROMPT } from "./system-prompt";
import { RAG_TOOLING_PROMPT } from "./rag-prompt";
import { GEMINI_FUNCTION_DECLARATIONS } from "@/lib/rag/tools";

// Roteamento de modelo por complexidade: FLASH cobre a esmagadora maioria das
// perguntas (dúvida pontual, resumo curto); PRO entra só quando o pedido tem
// cara de peça/minuta completa (produção longa e fundamentada, onde a
// qualidade de raciocínio jurídico compensa o custo/latência maior).
//
// Nomes de modelo (revisar periodicamente — o Google descontinua modelos sem
// aviso prévio longo; "gemini-2.0-flash"/"gemini-2.5-pro"/"text-embedding-004"
// pararam de responder de um dia pro outro e foi a causa raiz do chat ficar
// indisponível). Usamos o alias "-latest" propositalmente: aponta sempre para
// a versão atual recomendada pelo Google, então uma migração de geração (ex:
// 3.6 -> 3.7) não quebra o app de novo sem aviso. "gemini-pro-latest" NÃO é
// usado aqui porque a cota da chave de API atual pra modelos Pro se esgota
// quase imediatamente (testado: 429 já na segunda chamada) — até validar um
// plano pago, tarefa complexa também usa o modelo flash, só com teto de saída
// e orçamento de raciocínio maiores.
const MODELO_FLASH = "gemini-flash-latest";
const MODELO_PRO = "gemini-flash-latest";

// Quando o modelo principal estoura RPM (429 de quota) mesmo após as
// retentativas com backoff, cai pra um modelo de FAMÍLIA DIFERENTE — que tem
// pool de quota separado do "-latest" (mesma quota base, só alias distinto)
// — em vez de derrubar a feature inteira. "gemini-flash-lite-latest" é mais
// barato/rápido (custo/qualidade um degrau abaixo do Flash normal), mas
// melhor responder algo mais simples do que "IA indisponível" pro usuário.
const MODELO_FALLBACK_QUOTA = "gemini-flash-lite-latest";

const PALAVRAS_TAREFA_COMPLEXA =
  /\b(peti[cç][aã]o|minuta|contesta[cç][aã]o|recurso|apela[cç][aã]o|agravo|parecer|contrato completo|embargos)\b/i;

// Teto explícito de tokens de SAÍDA VISÍVEL (resposta de texto) por chamada.
// Não inclui os "thinking tokens" do Gemini 3 (ver THINKING_BUDGET_* abaixo)
// — esses são orçados à parte e nunca aparecem na resposta.
const MAX_OUTPUT_TOKENS_FLASH = 4096;
const MAX_OUTPUT_TOKENS_PRO = 8192;

// Modelos da família Gemini 3 fazem raciocínio interno ("thinking") antes de
// responder e cobram isso como tokens de saída MESMO em mensagens triviais —
// "oi" chegou a gastar ~190 tokens só de thinking em teste, contra ~10 de
// resposta visível. Essa é a causa raiz real do "gasto de token
// desproporcional" reportado (não era o RAG, que já filtra top-6 chunks
// relevantes) — era o thinking sem teto explícito. Um budget baixo mantém
// qualidade de resposta curta sem deixar o modelo "pensar" livremente em toda
// mensagem.
const THINKING_BUDGET_FLASH = 256;
const THINKING_BUDGET_PRO = 1024;

function escolherModelo(ultimaMensagem: string): string {
  if (ultimaMensagem.length > 1500 || PALAVRAS_TAREFA_COMPLEXA.test(ultimaMensagem)) {
    return MODELO_PRO;
  }
  return MODELO_FLASH;
}

function maxOutputTokensPara(modelo: string): number {
  return modelo === MODELO_PRO ? MAX_OUTPUT_TOKENS_PRO : MAX_OUTPUT_TOKENS_FLASH;
}

function thinkingBudgetPara(modelo: string): number {
  return modelo === MODELO_PRO ? THINKING_BUDGET_PRO : THINKING_BUDGET_FLASH;
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
  return /429|500|502|503|504|rate.?limit|timeout|ECONNRESET|ETIMEDOUT|UNAVAILABLE/i.test(mensagem);
}

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada");
  return new GoogleGenAI({ apiKey });
}

export type ChatTurno = { role: "user" | "assistant"; conteudo: string };

// Forma de function-call desacoplada do SDK do Gemini (@google/genai) — o
// módulo de fallback (lib/ia/provider.ts) também produz esse mesmo shape a
// partir da resposta do Groq, então nenhum caller precisa saber qual dos
// dois providers de fato respondeu.
export type ChamadaFuncao = { name: string; args: Record<string, unknown> };

export type RespostaIa = {
  texto: string;
  tokensIn: number;
  tokensOut: number;
  functionCalls: ChamadaFuncao[];
};

/**
 * Lançado quando TODA a cadeia de modelos Gemini esgota quota/rate-limit
 * (429) mesmo após retentativas — sinal explícito para `lib/ia/provider.ts`
 * decidir se aciona o fallback para Groq. Qualquer outro erro (prompt
 * inválido, 5xx real, rede) propaga como o erro original, nunca como este.
 */
export class QuotaExcedidaError extends Error {
  constructor(public readonly causaOriginal: unknown) {
    super("Quota do Gemini esgotada em todos os modelos da cadeia.");
    this.name = "QuotaExcedidaError";
  }
}

/**
 * Gera a resposta do copiloto. `contextoRag`, quando presente, é anexado
 * como parte final da ÚLTIMA mensagem do usuário (nunca misturado à
 * systemInstruction) — já vem pré-delimitado por
 * lib/rag/retrieval.ts#montarBlocoContexto. `habilitarFerramentas` liga o
 * function-calling nativo do Gemini para as tools propose_* (ver
 * lib/rag/tools.ts); por padrão desligado (ex: geração de análise de ficha
 * não precisa de tools).
 *
 * `systemPromptOverride`, quando presente, SUBSTITUI inteiramente o
 * `SYSTEM_PROMPT` do copiloto interno (nunca é concatenado a ele) — uso
 * exclusivo de pipelines de classificação focados (ex: triagem de lead
 * público, score de risco) que não devem herdar o escopo/persona do
 * copiloto. `responseSchema`, quando presente junto, força saída JSON
 * estruturada nativa do Gemini em vez de texto livre a ser parseado por
 * regex — desliga tools automaticamente (a API não aceita as duas coisas
 * juntas).
 */
export async function gerarRespostaGemini(
  historico: ChatTurno[],
  opcoes: {
    contextoRag?: string | null;
    habilitarFerramentas?: boolean;
    systemPromptOverride?: string;
    responseSchema?: Schema;
  } = {},
): Promise<RespostaIa> {
  const genAI = getClient();
  const ultima = historico[historico.length - 1];
  const anteriores = historico.slice(0, -1);

  const modeloEscolhido = escolherModelo(ultima.conteudo);
  const usaSchema = Boolean(opcoes.responseSchema);

  const mensagemFinal = opcoes.contextoRag
    ? `${ultima.conteudo}\n\n${opcoes.contextoRag}`
    : ultima.conteudo;

  // Cadeia de modelos a tentar: o escolhido por complexidade primeiro; se
  // ESSE estourar quota (RPM) mesmo após as retentativas de rede/5xx, cai
  // pro fallback de família diferente em vez de derrubar a feature. Sem
  // duplicar o mesmo nome de modelo (ex: fallback já é o próprio escolhido).
  const cadeiaModelos = [modeloEscolhido, MODELO_FALLBACK_QUOTA].filter(
    (modelo, indice, lista) => lista.indexOf(modelo) === indice,
  );

  let ultimoErro: unknown;
  for (const modelo of cadeiaModelos) {
    const chat = genAI.chats.create({
      model: modelo,
      history: anteriores.map((turno) => ({
        role: turno.role === "assistant" ? "model" : "user",
        parts: [{ text: turno.conteudo }],
      })),
      config: {
        systemInstruction: opcoes.systemPromptOverride ?? `${SYSTEM_PROMPT}\n${RAG_TOOLING_PROMPT}`,
        tools:
          !usaSchema && opcoes.habilitarFerramentas
            ? [{ functionDeclarations: GEMINI_FUNCTION_DECLARATIONS }]
            : undefined,
        maxOutputTokens: maxOutputTokensPara(modelo),
        thinkingConfig: { thinkingBudget: thinkingBudgetPara(modelo) },
        ...(usaSchema
          ? { responseMimeType: "application/json", responseSchema: opcoes.responseSchema }
          : {}),
      },
    });

    let erroDeQuotaEsgotouRetentativas = false;

    for (let tentativa = 0; tentativa < MAX_TENTATIVAS; tentativa++) {
      try {
        const resposta = await chat.sendMessage({ message: mensagemFinal });
        const uso = resposta.usageMetadata;

        return {
          texto: resposta.text ?? "",
          tokensIn: uso?.promptTokenCount ?? 0,
          tokensOut: uso?.candidatesTokenCount ?? 0,
          functionCalls: (resposta.functionCalls ?? [])
            .filter((chamada) => Boolean(chamada.name))
            .map((chamada) => ({ name: chamada.name as string, args: chamada.args ?? {} })),
        };
      } catch (erro) {
        ultimoErro = erro;
        const deQuota = isErroDeQuota(erro);
        // 429 de quota: no máximo UMA retentativa (a chamada seguinte já
        // esgotada de novo em <1s não ajuda em nada) e com backoff longo, pra
        // dar chance da janela de rate-limit da API resetar. Demais erros
        // transientes (rede/5xx) mantêm o backoff exponencial curto original.
        if (!isErroTransiente(erro) || tentativa === MAX_TENTATIVAS - 1 || (deQuota && tentativa >= 1)) {
          erroDeQuotaEsgotouRetentativas = deQuota;
          break;
        }
        await delay(deQuota ? BASE_DELAY_MS_QUOTA : BASE_DELAY_MS * 2 ** tentativa);
      }
    }

    // Erro não-transiente ou transiente-não-quota (rede/5xx já esgotado):
    // trocar de modelo não ajuda (não é problema de RPM), propaga direto.
    if (!erroDeQuotaEsgotouRetentativas) throw ultimoErro;
    console.error(
      `[gemini/gerarResposta] Quota esgotada em "${modelo}", tentando próximo modelo da cadeia (se houver).`,
    );
  }
  // Todos os modelos da cadeia Gemini esgotaram quota: sinaliza para
  // lib/ia/provider.ts acionar o fallback para Groq, em vez de propagar o
  // erro bruto do SDK do Gemini.
  throw new QuotaExcedidaError(ultimoErro);
}
