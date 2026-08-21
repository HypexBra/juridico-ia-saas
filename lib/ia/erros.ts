/**
 * Erros do domínio de IA compartilhados entre `lib/ia/gemini.ts`,
 * `lib/ia/groq.ts` e `lib/ia/provider.ts` — vivem num módulo próprio (em vez
 * de dentro de `gemini.ts`, como antes) para `groq.ts` poder lançar/checar o
 * mesmo tipo sem criar uma dependência circular entre os dois providers.
 */

/**
 * Lançado quando TODA a cadeia de modelos de UM provider esgota quota/
 * rate-limit (429) mesmo após retentativas, OU quando o pool de chaves
 * daquele provider está esgotado (`selecionarChave` retornou `null`) — sinal
 * explícito para `lib/ia/provider.ts` decidir se aciona o fallback para o
 * outro provider. Qualquer outro erro (prompt inválido, 5xx real, rede)
 * propaga como o erro original, nunca como este.
 */
export class QuotaExcedidaError extends Error {
  constructor(public readonly causaOriginal: unknown) {
    super("Quota do provedor de IA esgotada em todos os modelos/chaves da cadeia.");
    this.name = "QuotaExcedidaError";
  }
}

/**
 * Lançado por `lib/ia/provider.ts#gerarResposta` quando NENHUM provider
 * (nem Gemini, nem Groq) conseguiu responder — o fix do bug "a IA está
 * indisponível, não troca": antes, se o Gemini estourasse quota e o Groq
 * falhasse em seguida por QUALQUER motivo, o erro do Groq propagava sozinho
 * e mascarava que o Gemini também já tinha falhado, dificultando o
 * diagnóstico. Este erro carrega as duas causas originais para o log
 * estruturado em `app/app/chat/actions.ts` (evento `pool_llm_esgotado`)
 * diferenciar esgotamento real de erro de configuração.
 */
export class TodosProvidersIndisponiveisError extends Error {
  constructor(
    public readonly causaGemini: unknown,
    public readonly causaGroq: unknown,
  ) {
    super("Todos os providers de IA (Gemini e Groq) estão indisponíveis no momento.");
    this.name = "TodosProvidersIndisponiveisError";
  }
}
