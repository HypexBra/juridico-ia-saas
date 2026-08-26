// lib/embeddings.ts
//
// Transforma um texto em vetor numérico (embedding), usado tanto para
// indexar conteúdo novo quanto para transformar a pergunta do usuário
// na hora de buscar contexto relevante.
//
// Requer a variável de ambiente OPENAI_API_KEY configurada no projeto.

const OPENAI_EMBEDDING_URL = "https://api.openai.com/v1/embeddings";
const MODELO_EMBEDDING = "text-embedding-3-small"; // 1536 dimensões, barato e rápido

export async function gerarEmbedding(texto: string): Promise<number[]> {
  const [embedding] = await gerarEmbeddingsEmLote([texto]);
  return embedding;
}

// Gera embeddings para vários textos numa ÚNICA chamada à API — a OpenAI
// aceita um array em "input". Isso é o que evita o job diário estourar o
// tempo limite da função serverless quando há muitos documentos novos:
// em vez de N chamadas sequenciais (uma por chunk), são N/50 chamadas.
export async function gerarEmbeddingsEmLote(textos: string[]): Promise<number[][]> {
  if (textos.length === 0) return [];

  const resposta = await fetch(OPENAI_EMBEDDING_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODELO_EMBEDDING,
      input: textos,
    }),
  });

  if (!resposta.ok) {
    const erro = await resposta.text();
    throw new Error(`Falha ao gerar embeddings em lote: ${resposta.status} - ${erro}`);
  }

  const dados = await resposta.json();
  // A API retorna os embeddings na mesma ordem em que os textos foram enviados.
  return dados.data.map((item: { embedding: number[] }) => item.embedding);
}

// Quebra um texto longo em pedaços menores (chunks) antes de gerar embedding.
// Textos jurídicos longos (uma decisão inteira, por exemplo) perdem precisão
// de busca se forem indexados como um bloco único — pedaços de ~500 palavras
// com uma pequena sobreposição funcionam melhor na prática.
export function quebrarEmChunks(
  texto: string,
  tamanhoPalavras = 500,
  sobreposicaoPalavras = 50
): string[] {
  const palavras = texto.split(/\s+/);
  const chunks: string[] = [];

  let inicio = 0;
  while (inicio < palavras.length) {
    const fim = Math.min(inicio + tamanhoPalavras, palavras.length);
    chunks.push(palavras.slice(inicio, fim).join(" "));
    if (fim === palavras.length) break;
    inicio += tamanhoPalavras - sobreposicaoPalavras;
  }

  return chunks;
}
