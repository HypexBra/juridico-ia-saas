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

/**
 * Mensagem em PT-BR segura para exibir ao usuário quando uma chamada de IA
 * falha. Bug corrigido: chamadas one-shot (`lib/ia/chamada-estruturada.ts`,
 * usada por Document Intelligence/análise de processo/auditor) propagavam o
 * erro crú do provider — ex: `{"error":{"code":503,"message":"...
 * UNAVAILABLE"}}` — direto pro `erro`/`error` da action e a UI mostrava o
 * JSON bruto do Gemini pro usuário. Detecta erro transiente de provider
 * (5xx/429/timeout/rede) pela mensagem e troca por texto compreensível;
 * qualquer outro erro (ex: falha de parse, bug de schema) mantém a mensagem
 * original, que já é escrita em código nosso.
 */
export function mensagemErroIaParaUsuario(erro: unknown): string {
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  if (/429|5\d{2}|quota|rate.?limit|timeout|ECONNRESET|ETIMEDOUT|UNAVAILABLE/i.test(mensagem)) {
    return "A IA está sobrecarregada no momento. Tente novamente em alguns instantes.";
  }
  return mensagem;
}
