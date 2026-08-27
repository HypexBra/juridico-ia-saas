import "server-only";

import { GoogleGenAI, type Schema } from "@google/genai";
import { SYSTEM_PROMPT } from "./system-prompt";
import { PESQUISA_ATUALIZADA_PROMPT, RAG_TOOLING_PROMPT } from "./rag-prompt";
import { GEMINI_FUNCTION_DECLARATIONS } from "@/lib/rag/tools";
import { selecionarChave, registrarFalhaQuota } from "@/lib/ia/chaves/pool";
import { QuotaExcedidaError } from "@/lib/ia/erros";
import { mensagemTrivial } from "./gate-trivialidade";
import { decidirContexto, type ModoContexto } from "./roteador-contexto";

export type { ModoContexto };

export { QuotaExcedidaError };

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

/**
 * Opções de geração compartilhadas entre o fluxo one-shot (`gerarResposta
 * Gemini`) e o fluxo streaming (`gerarRespostaGeminiStream`).
 */
export type OpcoesGeracao = {
  contextoRag?: string | null;
  habilitarFerramentas?: boolean;
  systemPromptOverride?: string;
  responseSchema?: Schema;
  /**
   * Modo rápido (mensagens triviais — ver lib/ia/gate-trivialidade.ts):
   * desliga pesquisa web (grounding googleSearch) e zera o budget de
   * "thinking" da resposta. NUNCA usar em mensagem com conteúdo jurídico:
   * sem grounding, leis/súmulas citadas saem só da memória do modelo.
   */
  modoRapido?: boolean;
  /**
   * Modo de contexto resolvido por `lib/ia/roteador-contexto.ts`. Quando
   * presente, tem PRECEDÊNCIA sobre `modoRapido` e é o que decide se o
   * grounding `googleSearch` entra na config:
   *
   *   "rapido"     -> sem tools, thinking 0 (idêntico a modoRapido: true)
   *   "interno"    -> function-calling sim, googleSearch NÃO
   *   "atualizado" -> googleSearch + function-calling, mais o bloco
   *                   PESQUISA_ATUALIZADA_PROMPT na systemInstruction
   *
   * Ausente = comportamento legado (googleSearch sempre ligado fora do modo
   * rápido), para nenhum caller antigo mudar de comportamento sem migrar.
   */
  modoContexto?: ModoContexto;
  /**
   * Bloco de "Memória do escritório" (Fase 17) já montado/truncado por
   * blocoContextoEscritorio (lib/ia/contexto-escritorio.ts). Quando presente
   * E não-vazio E SEM `systemPromptOverride`, entra ENTRE o SYSTEM_PROMPT e o
   * RAG_TOOLING_PROMPT na systemInstruction. Precedência: quem passa um
   * override está substituindo a persona inteira do copiloto (pipelines de
   * classificação focados) e NÃO recebe o bloco — memória do escritório só
   * faz sentido dentro da persona. Bloco vazio/whitespace/null/ausente =
   * comportamento IDÊNTICO ao anterior à Fase 17 (zero custo de tokens).
   */
  blocoMemoriaEscritorio?: string | null;
};

/**
 * Composição pura da systemInstruction compartilhada pelos DOIS providers
 * (gemini.ts via configPara e groq.ts nos fluxos one-shot/stream) — extraída
 * em função própria para que Gemini e Groq NUNCA divirjam na ordem/composição
 * dos blocos e para ser testável sem mockar SDK/rede (ver
 * system-prompt-wiring.test.ts).
 *
 * Precedência: `systemPromptOverride` presente vence TUDO (features que
 * substituem a persona não recebem o bloco de memória); sem override, bloco
 * de memória não-vazio entra entre SYSTEM_PROMPT e RAG_TOOLING_PROMPT; caso
 * contrário, composição clássica `SYSTEM_PROMPT\nRAG_TOOLING_PROMPT`.
 */
export function comporSystemInstruction(
  opcoes: Pick<OpcoesGeracao, "systemPromptOverride" | "blocoMemoriaEscritorio" | "modoContexto">,
): string {
  const override = opcoes.systemPromptOverride;
  if (override) return override;

  // trim() decide o vazio (bloco whitespace-only não vale um "\n\n" extra na
  // system prompt); o valor injetado já sai normalizado pelo mesmo trim —
  // blocoContextoEscritorio nunca produz bordas de whitespace, então isso é
  // idempotente na prática e defensivo contra callers futuros.
  const bloco = opcoes.blocoMemoriaEscritorio?.trim();

  // Bloco de pesquisa datada SO no modo "atualizado": instruir a datar a
  // pesquisa quando nao ha pesquisa ligada e convite a inventar data (ver
  // PESQUISA_ATUALIZADA_PROMPT em ./rag-prompt.ts).
  const sufixoPesquisa = opcoes.modoContexto === "atualizado" ? `\n${PESQUISA_ATUALIZADA_PROMPT}` : "";

  if (!bloco) return `${SYSTEM_PROMPT}\n${RAG_TOOLING_PROMPT}${sufixoPesquisa}`;
  return `${SYSTEM_PROMPT}\n${bloco}\n${RAG_TOOLING_PROMPT}${sufixoPesquisa}`;
}

/**
 * Config de tools/thinking derivada das opções — única para os dois fluxos,
 * para que streaming e one-shot tenham SEMPRE o mesmo comportamento.
 */
export function configPara(opcoes: OpcoesGeracao, modelo: string) {
  const usaSchema = Boolean(opcoes.responseSchema);
  // `modoContexto` tem precedencia sobre `modoRapido`; sem ele, o
  // comportamento e o legado (ver comentario do campo em OpcoesGeracao).
  const trivial = opcoes.modoContexto ? opcoes.modoContexto === "rapido" : Boolean(opcoes.modoRapido);
  // Legado (sem modoContexto): pesquisa web ligada sempre que nao for trivial.
  const usarPesquisaWeb = opcoes.modoContexto ? opcoes.modoContexto === "atualizado" : !trivial;
  // Composição centralizada em comporSystemInstruction (mesma função usada
  // pelo Groq): override > bloco de memória > composição clássica.
  const systemInstruction = comporSystemInstruction(opcoes);
  const maxOutputTokens = maxOutputTokensPara(modelo);
  // Trivial: zero thinking — a resposta é curta e não há raciocínio a fazer;
  // cada token de thinking é latência pura pro usuário esperando "oi".
  const thinkingBudget = trivial ? 0 : thinkingBudgetPara(modelo);

  if (usaSchema) {
    return {
      systemInstruction,
      tools: undefined,
      toolConfig: undefined,
      maxOutputTokens,
      thinkingConfig: { thinkingBudget },
      responseMimeType: "application/json" as const,
      responseSchema: opcoes.responseSchema,
      httpOptions: { timeout: TIMEOUT_CHAMADA_MS },
    };
  }

  // Tools montadas por necessidade, nao "tudo ou nada":
  //  - googleSearch entra so quando `usarPesquisaWeb`. Antes ficava ligado em
  //    100% das mensagens nao-triviais, e e uma busca server-side de segundos
  //    cobrada em tokens de prompt · a maior fonte de latencia e custo do chat
  //    em perguntas que nao dependem do estado atual do mundo.
  //  - function-calling propose_* segue a decisao do caller, independente da
  //    pesquisa: uma pergunta interna ainda pode gerar uma proposta de acao.
  const tools = [
    ...(usarPesquisaWeb ? [{ googleSearch: {} }] : []),
    ...(!trivial && opcoes.habilitarFerramentas ? [{ functionDeclarations: GEMINI_FUNCTION_DECLARATIONS }] : []),
  ];

  return {
    systemInstruction,
    tools: tools.length > 0 ? tools : undefined,
    // `includeServerSideToolInvocations` so faz sentido junto de uma tool
    // server-side (googleSearch); com function-calling puro e ruido na config.
    toolConfig: usarPesquisaWeb ? { includeServerSideToolInvocations: true } : undefined,
    maxOutputTokens,
    thinkingConfig: { thinkingBudget },
    responseMimeType: undefined,
    responseSchema: undefined,
    httpOptions: { timeout: TIMEOUT_CHAMADA_MS },
  };
}

/**
 * Detecta trivialidade na ÚLTIMA mensagem quando o caller não decidiu
 * explicitamente. Centralizado aqui para que TODOS os callers do provider
 * (chat, futuros fluxos) herdem o atalho de graça.
 */
/**
 * Resolve o modo de contexto quando o caller nao decidiu. Mesma guarda de
 * `resolverModoRapido`: pipelines com `responseSchema`/`systemPromptOverride`
 * (triagem de lead, score de risco, analises estruturadas) NAO entram no
 * roteamento · eles ja substituem a persona e nunca usaram pesquisa web nem
 * RAG, entao aplicar o roteador ali so acrescentaria comportamento novo a
 * features que ninguem pediu para mudar.
 *
 * Devolver `undefined` significa "sem modo": `configPara` cai no
 * comportamento legado, preservando o que essas features ja faziam.
 */
export function resolverModoContexto(
  historico: ChatTurno[],
  opcoes: OpcoesGeracao,
): ModoContexto | undefined {
  if (opcoes.modoContexto) return opcoes.modoContexto;
  if (opcoes.responseSchema || opcoes.systemPromptOverride) return undefined;
  // Caller antigo que so passa `modoRapido: true` continua valendo.
  if (opcoes.modoRapido === true) return "rapido";
  const ultima = historico[historico.length - 1];
  return ultima ? decidirContexto(ultima.conteudo).modo : undefined;
}

export function resolverModoRapido(historico: ChatTurno[], opcoes: OpcoesGeracao): boolean {
  if (opcoes.modoRapido !== undefined || opcoes.responseSchema || opcoes.systemPromptOverride) {
    return Boolean(opcoes.modoRapido);
  }
  const ultima = historico[historico.length - 1];
  return ultima ? mensagemTrivial(ultima.conteudo) : false;
}

const MAX_TENTATIVAS = 3;
const BASE_DELAY_MS = 600;
// 429 aqui é quota/rate-limit da API do Gemini, não uma falha de rede
// pontual: retry rápido em cima de rate-limit só empilha mais chamadas
// contra uma janela de quota já estourada, piorando o problema em vez de
// resolvê-lo. Backoff bem mais longo (mín. 15s) dá tempo da janela de quota
// (tipicamente por minuto) resetar antes da próxima tentativa.
const BASE_DELAY_MS_QUOTA = 15_000;

// Sem teto, um hang do SDK (nem erro nem resposta) prende o `await` pra
// sempre e o retry/fallback abaixo nunca dispara — mesmo bug corrigido em
// lib/ia/chamada-estruturada.ts e lib/rag/embeddings.ts.
const TIMEOUT_CHAMADA_MS = 45_000;

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

/**
 * Client do Gemini montado com uma chave vinda do pool interno
 * (`lib/ia/chaves/pool.ts`, tabela `ia_provider_chaves`) — cada TENTATIVA do
 * loop de retry abaixo chama isto de novo, então uma chave que acabou de
 * levar 429 (marcada indisponível por `registrarFalhaQuota`) não é reusada
 * na tentativa seguinte, mesmo dentro da mesma requisição de chat.
 *
 * Fallback de leitura de `GEMINI_API_KEY` (env var fixa) SÓ quando não há
 * nenhuma linha ativa para "gemini" na tabela — transição para ambientes
 * que ainda não cadastraram chaves via /admin/ia-chaves, documentado em
 * .env.example. Retorna `null` quando nem pool nem env var têm uma chave
 * disponível, para o caller lançar `QuotaExcedidaError` e acionar o
 * fallback cross-provider.
 */
async function getClient(): Promise<{ genAI: GoogleGenAI; chaveId: string | null } | null> {
  const chave = await selecionarChave("gemini");
  if (chave) {
    return { genAI: new GoogleGenAI({ apiKey: chave.chavePlana }), chaveId: chave.id };
  }

  const apiKeyEnv = process.env.GEMINI_API_KEY;
  if (apiKeyEnv) {
    return { genAI: new GoogleGenAI({ apiKey: apiKeyEnv }), chaveId: null };
  }

  return null;
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
  /**
   * Nome do modelo que DE FATO respondeu (observabilidade — Fase 27): no
   * Gemini é a variável do loop sobre cadeiaModelos (o escolhido por
   * complexidade ou o fallback de quota); no Groq, a constante MODELO_GROQ.
   * Opcional por retrocompatibilidade: callers antigos podem construir
   * RespostaIa sem o campo (ex: testes), e o registro em uso_ia aceita null.
   */
  modelo?: string;
};

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
 * copiloto. Por isso, quando o override está presente, o bloco de memória do
 * escritório (`blocoMemoriaEscritorio`, Fase 17) é IGNORADO — ver
 * comporSystemInstruction. `responseSchema`, quando presente junto, força
 * saída JSON estruturada nativa do Gemini em vez de texto livre a ser
 * parseado por regex — desliga tools automaticamente (a API não aceita as
 * duas coisas juntas).
 */
export async function gerarRespostaGemini(
  historico: ChatTurno[],
  opcoes: OpcoesGeracao = {},
): Promise<RespostaIa> {
  const ultima = historico[historico.length - 1];
  const anteriores = historico.slice(0, -1);

  const modeloEscolhido = escolherModelo(ultima.conteudo);
  const modoRapido = resolverModoRapido(historico, opcoes);
  const modoContexto = resolverModoContexto(historico, opcoes);

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
    let erroTransienteEsgotouRetentativas = false;

    for (let tentativa = 0; tentativa < MAX_TENTATIVAS; tentativa++) {
      // Chave (do pool ou, em transição, da env var) obtida A CADA
      // tentativa: se a anterior acabou de ser marcada indisponível por
      // `registrarFalhaQuota` (dentro do catch abaixo), esta tentativa já
      // pega outra chave do pool em vez de repetir a mesma.
      const cliente = await getClient();
      if (!cliente) {
        // Pool esgotado (nenhuma chave ativa/disponível) e sem
        // GEMINI_API_KEY de transição configurada: não há com o que tentar
        // de novo — sinaliza direto para o fallback cross-provider.
        throw new QuotaExcedidaError(new Error("Pool de chaves Gemini esgotado e GEMINI_API_KEY não configurada."));
      }
      const { genAI, chaveId } = cliente;

      const chat = genAI.chats.create({
        model: modelo,
        history: anteriores.map((turno) => ({
          role: turno.role === "assistant" ? "model" : "user",
          parts: [{ text: turno.conteudo }],
        })),
        config: configPara({ ...opcoes, modoRapido, modoContexto }, modelo),
      });

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
          // Modelo REAL que respondeu (pode ser o fallback de quota da
          // cadeia, não o escolhido por complexidade) — observabilidade.
          modelo,
        };
      } catch (erro) {
        ultimoErro = erro;
        const deQuota = isErroDeQuota(erro);
        // Chave veio do pool (não da env var de transição) e o erro é
        // realmente de quota/rate-limit: registra a falha para o pool parar
        // de selecionar esta chave por 65s (ver migration 0032), ANTES de
        // decidir a próxima tentativa/modelo.
        if (deQuota && chaveId) {
          const motivo = erro instanceof Error ? erro.message : String(erro);
          await registrarFalhaQuota(chaveId, motivo);
        }
        // 429 de quota: no máximo UMA retentativa (a chamada seguinte já
        // esgotada de novo em <1s não ajuda em nada) e com backoff longo, pra
        // dar chance da janela de rate-limit da API resetar. Demais erros
        // transientes (rede/5xx) mantêm o backoff exponencial curto original.
        const transiente = isErroTransiente(erro);
        if (!transiente || tentativa === MAX_TENTATIVAS - 1 || (deQuota && tentativa >= 1)) {
          erroTransienteEsgotouRetentativas = transiente;
          break;
        }
        await delay(deQuota ? BASE_DELAY_MS_QUOTA : BASE_DELAY_MS * 2 ** tentativa);
      }
    }

    // Erro não-transiente (prompt inválido etc.): trocar de modelo não ajuda,
    // propaga direto. Erro transiente (quota OU sobrecarga/5xx/rede) esgotado
    // neste modelo: vale tentar o próximo da cadeia — mesmo fix do bug em
    // lib/ia/chamada-estruturada.ts (um 503 "UNAVAILABLE" não é quota, mas
    // travava aqui e nunca chegava a trocar de modelo/provider).
    if (!erroTransienteEsgotouRetentativas) throw ultimoErro;
    console.error(
      `[gemini/gerarResposta] Falha transiente em "${modelo}", tentando próximo modelo da cadeia (se houver).`,
    );
  }
  // Todos os modelos da cadeia Gemini esgotaram por erro transiente (quota OU
  // 5xx/rede): sinaliza para lib/ia/provider.ts acionar o fallback
  // cross-provider para Groq, em vez de propagar o erro bruto do SDK do
  // Gemini (bug: 503 nunca acionava o fallback, só 429 acionava).
  throw new QuotaExcedidaError(ultimoErro);
}

// ─────────────────────────────────────────────────────────────────────────────
// STREAMING — mesmo pipeline de retry/pool do fluxo one-shot acima, mas
// emitindo deltas de texto conforme o modelo gera. A percepção de latência
// do chat cai de "segundos em silêncio" para "primeiro token em ~1s".
//
// Contrato do gerador:
// - Emite `StreamEventoDelta` para cada trecho de texto gerado.
// - Ao final, emite UM `StreamEventoFim` com o agregado (texto completo,
//   tokens, functionCalls) — o caller persiste a mensagem e processa
//   propostas exatamente como no fluxo one-shot.
// - Erro ANTES do primeiro delta: lança (caller pode tentar fallback
//   cross-provider com a interface limpa).
// - Erro DEPOIS do primeiro delta: emite `StreamEventoErro` e encerra — não
//   dá pra recuperar um stream pela metade; o texto parcial já entregue é
//   mantido visível com aviso.
// - Retry/backoff SÓ antes do primeiro delta: depois que tokens começaram a
//   fluir, repetir duplicaria texto já mostrado ao usuário.

export type StreamEvento =
  | { tipo: "delta"; texto: string }
  | { tipo: "fim"; resposta: RespostaIa }
  | { tipo: "erro"; mensagem: string };

export async function* gerarRespostaGeminiStream(
  historico: ChatTurno[],
  opcoes: OpcoesGeracao = {},
): AsyncGenerator<StreamEvento, void, unknown> {
  const ultima = historico[historico.length - 1];
  const anteriores = historico.slice(0, -1);

  const modeloEscolhido = escolherModelo(ultima.conteudo);
  const modoRapido = resolverModoRapido(historico, opcoes);
  const modoContexto = resolverModoContexto(historico, opcoes);

  const mensagemFinal = opcoes.contextoRag
    ? `${ultima.conteudo}\n\n${opcoes.contextoRag}`
    : ultima.conteudo;

  const cadeiaModelos = [modeloEscolhido, MODELO_FALLBACK_QUOTA].filter(
    (modelo, indice, lista) => lista.indexOf(modelo) === indice,
  );

  let ultimoErro: unknown;
  const chamadasColetadas: ChamadaFuncao[] = [];

  for (const modelo of cadeiaModelos) {
    for (let tentativa = 0; tentativa < MAX_TENTATIVAS; tentativa++) {
      const cliente = await getClient();
      if (!cliente) {
        throw new QuotaExcedidaError(new Error("Pool de chaves Gemini esgotado e GEMINI_API_KEY não configurada."));
      }
      const { genAI, chaveId } = cliente;

      const chat = genAI.chats.create({
        model: modelo,
        history: anteriores.map((turno) => ({
          role: turno.role === "assistant" ? "model" : "user",
          parts: [{ text: turno.conteudo }],
        })),
        config: configPara({ ...opcoes, modoRapido, modoContexto }, modelo),
      });

      let stream;
      try {
        // sendMessageStream dispara a requisição já aqui: erros de quota/5xx
        // na ABERTURA do stream são capturados no bloco abaixo e permitem
        // retry/fallback com a interface limpa (nenhum token emitido).
        stream = await chat.sendMessageStream({ message: mensagemFinal });
      } catch (erro) {
        ultimoErro = erro;
        const deQuota = isErroDeQuota(erro);
        if (deQuota && chaveId) {
          await registrarFalhaQuota(chaveId, erro instanceof Error ? erro.message : String(erro));
        }
        const transiente = isErroTransiente(erro);
        if (!transiente || tentativa === MAX_TENTATIVAS - 1 || (deQuota && tentativa >= 1)) {
          break; // tenta próximo modelo da cadeia (ou lança QuotaExcedidaError lá embaixo)
        }
        await delay(deQuota ? BASE_DELAY_MS_QUOTA : BASE_DELAY_MS * 2 ** tentativa);
        continue;
      }

      let textoCompleto = "";
      let tokensIn = 0;
      let tokensOut = 0;
      let primeiroTokenEmitido = false;

      try {
        for await (const chunk of stream) {
          const uso = chunk.usageMetadata;
          if (uso?.promptTokenCount) tokensIn = uso.promptTokenCount;
          if (uso?.candidatesTokenCount) tokensOut = uso.candidatesTokenCount;
          const pedaco = chunk.text ?? "";
          if (pedaco) {
            primeiroTokenEmitido = true;
            textoCompleto += pedaco;
            yield { tipo: "delta", texto: pedaco };
          }
          const chamadas = (chunk.functionCalls ?? []).filter((c) => Boolean(c.name));
          for (const chamada of chamadas) {
            chamadasColetadas.push({ name: chamada.name as string, args: chamada.args ?? {} });
          }
        }

        yield {
          tipo: "fim",
          resposta: {
            texto: textoCompleto,
            tokensIn,
            tokensOut,
            functionCalls: [...chamadasColetadas],
            // Modelo REAL que respondeu (variável do loop da cadeia).
            modelo,
          },
        };
        return;
      } catch (erro) {
        // Falha NO MEIO do stream: sem retry (duplicaria texto já exibido).
        // Se nenhum token tinha saído ainda, ainda é recuperável: trata como
        // falha de abertura e segue a cadeia.
        ultimoErro = erro;
        if (!primeiroTokenEmitido) {
          const deQuota = isErroDeQuota(erro);
          if (deQuota && chaveId) {
            await registrarFalhaQuota(chaveId, erro instanceof Error ? erro.message : String(erro));
          }
          if (tentativa < MAX_TENTATIVAS - 1 && isErroTransiente(erro)) {
            await delay(deQuota ? BASE_DELAY_MS_QUOTA : BASE_DELAY_MS * 2 ** tentativa);
            continue;
          }
          break;
        }
        yield {
          tipo: "erro",
          mensagem:
            "A resposta foi interrompida no meio da geração. O texto parcial acima foi mantido — reenvie a mensagem para continuar.",
        };
        return;
      }
    }
  }

  throw new QuotaExcedidaError(ultimoErro);
}
