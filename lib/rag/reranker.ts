import "server-only";

/**
 * Re-ranqueamento por Cross-Encoder (opcional): refina a ordem dos
 * candidatos já fundidos por RRF (`buscar_chunks_hibrido`) avaliando o par
 * (pergunta, trecho) em conjunto — um bi-encoder (embedding) nunca faz essa
 * avaliação cruzada, só compara vetores isolados.
 *
 * Sem provider de cross-encoder próprio na stack atual (Gemini/Groq não
 * expõem um endpoint de rerank) e sem contratar um novo provider às cegas,
 * isto integra com a API de rerank da Jina AI (tem free tier, modelo
 * multilíngue com suporte a português — comparável ao bge-reranker-v2-m3
 * citado como referência de mercado) SE `JINA_API_KEY` estiver configurada.
 * Sem a chave, é passthrough puro: a ordem do RRF já é boa o bastante para
 * não bloquear o RAG por uma dependência externa opcional — nunca lança,
 * nunca é obrigatório configurar.
 */

const JINA_RERANK_URL = "https://api.jina.ai/v1/rerank";
const MODELO_RERANK = "jina-reranker-v2-base-multilingual";
const TIMEOUT_MS = 8_000;

export type CandidatoReranqueavel = {
  id: string;
  conteudo: string;
};

/**
 * Reordena `candidatos` pela relevância cruzada (pergunta, trecho) segundo o
 * cross-encoder. Retorna os candidatos originais, na mesma ordem recebida,
 * quando `JINA_API_KEY` não está configurada ou a chamada falha — reranking
 * é refinamento, nunca requisito para o RAG funcionar.
 */
export async function rerankCandidatos<T extends CandidatoReranqueavel>(
  pergunta: string,
  candidatos: readonly T[],
): Promise<T[]> {
  const apiKey = process.env.JINA_API_KEY;
  if (!apiKey || candidatos.length === 0) return [...candidatos];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const resposta = await fetch(JINA_RERANK_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODELO_RERANK,
        query: pergunta,
        documents: candidatos.map((c) => c.conteudo),
        top_n: candidatos.length,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!resposta.ok) throw new Error(`Jina rerank respondeu ${resposta.status}`);

    const corpo = (await resposta.json()) as {
      results?: Array<{ index: number; relevance_score: number }>;
    };
    const resultados = corpo.results;
    if (!resultados || resultados.length === 0) return [...candidatos];

    return resultados
      .filter((r) => Number.isInteger(r.index) && r.index >= 0 && r.index < candidatos.length)
      .map((r) => candidatos[r.index]);
  } catch (erro) {
    console.error(
      "[rag/reranker] Falha ao chamar o cross-encoder; seguindo com a ordem do RRF:",
      erro instanceof Error ? erro.message : erro,
    );
    return [...candidatos];
  }
}
