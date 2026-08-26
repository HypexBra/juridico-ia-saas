// lib/consultar-rag.ts
//
// Qualquer módulo de IA do produto (score de persuasão, advogado do contra,
// geração de peça, sugestão de tese) deve chamar esta função ANTES de montar
// o prompt para a IA, e injetar o resultado como contexto — em vez de deixar
// a IA responder só com o que ela "lembra" do treinamento.

import { sql } from "@vercel/postgres";
import { gerarEmbedding } from "@/lib/embeddings";

export interface TrechoRelevante {
  conteudo: string;
  fonte: string;
  tipo: string;
  urlOriginal: string;
  dataPublicacao: string;
  similaridade: number;
}

export async function consultarBaseJuridica(
  pergunta: string,
  opcoes: { limite?: number; relator?: string; tribunalVara?: string } = {}
): Promise<TrechoRelevante[]> {
  const { limite = 5, relator, tribunalVara } = opcoes;

  const embeddingPergunta = await gerarEmbedding(pergunta);
  const vetorFormatado = JSON.stringify(embeddingPergunta);

  // Busca por similaridade de cosseno (menor distância = mais relevante),
  // com filtro opcional por relator/vara — útil para os módulos P2.1/P2.2.
  const resultado = await sql`
    SELECT
      conteudo,
      fonte,
      tipo,
      url_original,
      data_publicacao,
      1 - (embedding <=> ${vetorFormatado}::vector) AS similaridade
    FROM base_juridica
    WHERE
      (${relator ?? null}::text IS NULL OR relator = ${relator ?? null})
      AND (${tribunalVara ?? null}::text IS NULL OR tribunal_vara = ${tribunalVara ?? null})
    ORDER BY embedding <=> ${vetorFormatado}::vector
    LIMIT ${limite}
  `;

  return resultado.rows.map((linha) => ({
    conteudo: linha.conteudo,
    fonte: linha.fonte,
    tipo: linha.tipo,
    urlOriginal: linha.url_original,
    dataPublicacao: linha.data_publicacao,
    similaridade: linha.similaridade,
  }));
}

// Exemplo de uso dentro de um módulo de IA existente (ex: geração de peça):
//
// const contexto = await consultarBaseJuridica(
//   "prescrição em ação de cobrança de honorários advocatícios",
//   { limite: 5 }
// );
//
// const promptComContexto = `
//   Contexto jurídico atualizado (use como referência, cite a fonte e a data):
//   ${contexto.map(c => `- [${c.fonte}, ${c.dataPublicacao}] ${c.conteudo}`).join("\n")}
//
//   Com base nesse contexto, ${perguntaOriginalDoUsuario}
// `;
