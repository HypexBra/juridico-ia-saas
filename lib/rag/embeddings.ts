import "server-only";

import { GoogleGenerativeAI, TaskType } from "@google/generative-ai";

const MODELO_EMBEDDING = "text-embedding-004"; // 768 dimensões — bate com embeddings_chunks.embedding vector(768)
const MAX_TENTATIVAS = 3;
const BASE_DELAY_MS = 500;

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada");
  return new GoogleGenerativeAI(apiKey);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isErroTransiente(erro: unknown): boolean {
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  return /429|500|502|503|504|rate.?limit|timeout|ECONNRESET|ETIMEDOUT/i.test(mensagem);
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
  const model = genAI.getGenerativeModel({ model: MODELO_EMBEDDING });

  let ultimoErro: unknown;
  for (let tentativa = 0; tentativa < MAX_TENTATIVAS; tentativa++) {
    try {
      const resultado = await model.embedContent({
        content: { role: "user", parts: [{ text: texto }] },
        taskType: taskType === "RETRIEVAL_DOCUMENT" ? TaskType.RETRIEVAL_DOCUMENT : TaskType.RETRIEVAL_QUERY,
      });
      return resultado.embedding.values;
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
