import "server-only";

import { GoogleGenAI } from "@google/genai";

// "text-embedding-004" foi descontinuado pelo Google (404) — substituído por
// "gemini-embedding-001". Esse modelo nativamente devolve vetores de 3072
// dimensões, mas a coluna `embeddings_chunks.embedding` é `vector(768)`
// (migration 0002); em vez de migrar a coluna (reindexaria tudo e mudaria
// custo/armazenamento), usamos `outputDimensionality: 768` — o próprio
// modelo suporta truncar/projetar pra essa dimensão sem precisar trocar o
// schema (testado e confirmado contra a API real).
const MODELO_EMBEDDING = "gemini-embedding-001";
const DIMENSOES_EMBEDDING = 768; // bate com embeddings_chunks.embedding vector(768)
const MAX_TENTATIVAS = 3;
const BASE_DELAY_MS = 500;

// Sem fallback para Groq aqui (ao contrário de lib/ia/provider.ts): a Groq
// tem um endpoint de embeddings (`nomic-embed-text-v1_5`), mas é um espaço
// vetorial DIFERENTE do `gemini-embedding-001` já usado para indexar toda a
// base — misturar os dois na mesma coluna `vector(768)` tornaria a busca por
// similaridade sem sentido (comparar vetores de modelos distintos não é
// comparável). Embeddings ficam só no Gemini; o retry abaixo já cobre 429/5xx.
function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada");
  return new GoogleGenAI({ apiKey });
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isErroTransiente(erro: unknown): boolean {
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  return /429|500|502|503|504|rate.?limit|timeout|ECONNRESET|ETIMEDOUT|UNAVAILABLE/i.test(mensagem);
}

/**
 * Gera o embedding de um texto com retry exponencial para erros transientes
 * do provider (429/5xx/timeout). taskType distingue o vetor de indexação
 * (RETRIEVAL_DOCUMENT) do vetor de busca (RETRIEVAL_QUERY) — o Google
 * recomenda isso para melhorar a qualidade do ranking de similaridade.
 */
export async function gerarEmbedding(
  texto: string,
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY",
): Promise<number[]> {
  const genAI = getClient();

  let ultimoErro: unknown;
  for (let tentativa = 0; tentativa < MAX_TENTATIVAS; tentativa++) {
    try {
      const resultado = await genAI.models.embedContent({
        model: MODELO_EMBEDDING,
        contents: texto,
        config: { taskType, outputDimensionality: DIMENSOES_EMBEDDING },
      });
      const valores = resultado.embeddings?.[0]?.values;
      if (!valores) throw new Error("Resposta de embedding sem vetor.");
      return valores;
    } catch (erro) {
      ultimoErro = erro;
      if (!isErroTransiente(erro) || tentativa === MAX_TENTATIVAS - 1) throw erro;
      await delay(BASE_DELAY_MS * 2 ** tentativa);
    }
  }
  throw ultimoErro;
}

/** Gera embeddings em lote, sequencial com retry por item (evita estourar rate-limit em rajada). */
export async function gerarEmbeddingsEmLote(
  textos: string[],
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY",
): Promise<number[][]> {
  const resultado: number[][] = [];
  for (const texto of textos) {
    resultado.push(await gerarEmbedding(texto, taskType));
  }
  return resultado;
}
