import "server-only";

import { GoogleGenAI, type Part, type Schema } from "@google/genai";

/**
 * Helper compartilhado de "chamada estruturada one-shot" ao Gemini
 * (`responseSchema` fixo + parte multimodal opcional + retry/backoff/
 * fallback-por-quota) — extraído de
 * `lib/analise-processo/analisar.ts#chamarGeminiComSchema` (ver ADR 0011,
 * seção 3). Mantém 100% da lógica de retry já validada em produção pela Fase
 * 2; não simplifica nem muda comportamento observável.
 *
 * Deliberadamente para chamadas SEM histórico (cada chamada é independente) —
 * `lib/ia/gemini.ts` (chat multi-turno com `contextoRag`) fica fora do escopo
 * deste helper, mesmo racional já documentado no ADR 0011.
 */

const MAX_TENTATIVAS = 3;
const BASE_DELAY_MS = 600;
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

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada");
  return new GoogleGenAI({ apiKey });
}

export type ParametrosRespostaEstruturada = {
  /** Texto do turno do usuário (instrução + dado delimitado). */
  promptTexto: string;
  /** Parte multimodal opcional (`inlineData` de imagem) — `null` quando o
   * conteúdo é só texto. */
  parteExtra: Part | null;
  systemPrompt: string;
  /** Schema JSON nativo do Gemini (`responseSchema`) — desliga `tools`
   * automaticamente na chamada. */
  responseSchema: Schema;
  maxOutputTokens: number;
  thinkingBudget: number;
  /** Cadeia de modelos, na ordem de tentativa — quando o primeiro esgota
   * quota (429), tenta o próximo. Duplicatas são removidas preservando a
   * primeira ocorrência. */
  cadeiaModelos: string[];
  /** Prefixo usado nos logs de fallback-por-quota (ex: "[analise-processo/analisar]") —
   * opcional, default genérico. */
  logPrefixo?: string;
};

/**
 * Chama o Gemini uma única vez (sem histórico de chat — cada chamada é
 * independente) com `responseSchema` fixo e cadeia de fallback de modelo em
 * caso de quota esgotada. Mesmo padrão de retry/backoff de
 * `lib/ia/gemini.ts#gerarRespostaGemini`, generalizado para reuso entre
 * features (análise de processo, Document Intelligence, e futuras chamadas
 * estruturadas one-shot). Nunca simplifica a lógica original: mesma
 * distinção entre erro de quota (backoff longo, no máx. 1 retentativa antes
 * de trocar de modelo) e erro transiente de rede (backoff curto,
 * exponencial).
 */
export async function gerarRespostaEstruturada({
  promptTexto,
  parteExtra,
  systemPrompt,
  responseSchema,
  maxOutputTokens,
  thinkingBudget,
  cadeiaModelos,
  logPrefixo = "[ia/chamada-estruturada]",
}: ParametrosRespostaEstruturada): Promise<unknown> {
  const genAI = getClient();
  const parts: Part[] = [{ text: promptTexto }];
  if (parteExtra) parts.push(parteExtra);

  const modelosUnicos = cadeiaModelos.filter((modelo, indice, lista) => lista.indexOf(modelo) === indice);

  let ultimoErro: unknown;
  for (const modelo of modelosUnicos) {
    let erroDeQuotaEsgotouRetentativas = false;

    for (let tentativa = 0; tentativa < MAX_TENTATIVAS; tentativa++) {
      try {
        const resposta = await genAI.models.generateContent({
          model: modelo,
          contents: [{ role: "user", parts }],
          config: {
            systemInstruction: systemPrompt,
            maxOutputTokens,
            thinkingConfig: { thinkingBudget },
            responseMimeType: "application/json",
            responseSchema,
          },
        });

        const texto = resposta.text;
        if (!texto) throw new Error("Resposta vazia do Gemini.");
        return JSON.parse(texto);
      } catch (erro) {
        ultimoErro = erro;
        const deQuota = isErroDeQuota(erro);
        if (!isErroTransiente(erro) || tentativa === MAX_TENTATIVAS - 1 || (deQuota && tentativa >= 1)) {
          erroDeQuotaEsgotouRetentativas = deQuota;
          break;
        }
        await delay(deQuota ? BASE_DELAY_MS_QUOTA : BASE_DELAY_MS * 2 ** tentativa);
      }
    }

    if (!erroDeQuotaEsgotouRetentativas) throw ultimoErro;
    console.error(`${logPrefixo} Quota esgotada em "${modelo}", tentando próximo modelo da cadeia (se houver).`);
  }

  throw ultimoErro instanceof Error ? ultimoErro : new Error("Falha desconhecida ao chamar o Gemini.");
}
