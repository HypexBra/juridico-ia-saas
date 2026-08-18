import "server-only";

/**
 * Cache em memória do embedding de QUERY (RETRIEVAL_QUERY), chaveado pelo
 * texto normalizado da pergunta. Objetivo: evitar gerar de novo o mesmo
 * embedding quando o usuário reenvia uma pergunta idêntica (ou muito
 * parecida após normalização) pouco tempo depois — cada chamada de embedding
 * é uma requisição paga/rate-limited à API do Gemini.
 *
 * Nunca cacheamos embedding de DOCUMENTO (RETRIEVAL_DOCUMENT/indexação): o
 * texto de um chunk é, na prática, sempre distinto entre fontes, então o
 * cache nunca acertaria e só ocuparia memória à toa.
 *
 * LIMITAÇÃO CONHECIDA (mesmo padrão aceito em lib/rate-limit.ts): o cache
 * vive só na memória do processo Node atual. Em ambiente serverless com
 * múltiplas instâncias, cada uma tem seu próprio cache — não é uma garantia
 * de deduplicação global, só uma otimização best-effort que ajuda bastante
 * dentro da MESMA instância morna (o caso comum de usuário reenviando/
 * reformulando a mesma pergunta em sequência rápida). Não requer
 * infraestrutura nova (Redis/tabela) para um ganho já real.
 */

const TTL_MS = 10 * 60 * 1000; // 10 minutos — janela curta o suficiente para não servir embedding "velho" de forma perceptível
const MAX_ENTRADAS = 200; // limite duro de memória; acima disso começa a descartar as mais antigas

type EntradaCache = { embedding: number[]; expiraEm: number };

const cache = new Map<string, EntradaCache>();

/** Normaliza a pergunta para aumentar a chance de cache hit em reformulações triviais (espaços, maiúsculas). */
function normalizar(texto: string): string {
  return texto.trim().toLowerCase().replace(/\s+/g, " ");
}

function limparExpirados(agora: number) {
  if (cache.size < MAX_ENTRADAS) return;
  for (const [chave, entrada] of cache) {
    if (entrada.expiraEm <= agora) cache.delete(chave);
  }
  // Ainda cheio após remover expirados (rajada real de perguntas distintas):
  // descarta a entrada mais antiga (primeira do Map, ordem de inserção) em
  // vez de deixar crescer sem limite.
  if (cache.size >= MAX_ENTRADAS) {
    const maisAntiga = cache.keys().next().value;
    if (maisAntiga !== undefined) cache.delete(maisAntiga);
  }
}

export function obterEmbeddingCacheado(pergunta: string): number[] | null {
  const chave = normalizar(pergunta);
  const entrada = cache.get(chave);
  if (!entrada) return null;
  if (entrada.expiraEm <= Date.now()) {
    cache.delete(chave);
    return null;
  }
  return entrada.embedding;
}

export function guardarEmbeddingCache(pergunta: string, embedding: number[]) {
  const agora = Date.now();
  limparExpirados(agora);
  cache.set(normalizar(pergunta), { embedding, expiraEm: agora + TTL_MS });
}
