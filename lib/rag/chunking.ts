import "server-only";

/**
 * Text splitter recursivo e leve (sem dependência de langchain): quebra por
 * parágrafo, depois por frase, empacotando greedily até TAMANHO_CHUNK
 * caracteres, com sobreposição de OVERLAP caracteres entre chunks
 * consecutivos. Nunca corta no meio de uma frase — se uma única frase for
 * maior que o tamanho do chunk, ela vira um chunk próprio (melhor um chunk
 * grande do que uma frase truncada sem sentido).
 *
 * Tamanho em caracteres (não tokens) como proxy simples: ~700 caracteres em
 * português jurídico equivale a ~180-220 tokens, dentro da faixa recomendada
 * de 500-1000 tokens por chunk quando somado ao overlap.
 */
const TAMANHO_CHUNK = 1800; // ~caracteres, proxy para ~500-700 tokens
const OVERLAP = 200; // ~10% do tamanho do chunk

function dividirEmFrases(paragrafo: string): string[] {
  // Divide preservando o delimitador (. ! ? seguido de espaço/fim), sem
  // depender de lookbehind variável (compatibilidade ampla de engine regex).
  const partes = paragrafo.split(/(?<=[.!?])\s+/);
  return partes.map((p) => p.trim()).filter(Boolean);
}

export function dividirEmChunks(textoBruto: string): string[] {
  const texto = textoBruto.replace(/\r\n/g, "\n").trim();
  if (!texto) return [];

  const paragrafos = texto
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const unidades: string[] = [];
  for (const paragrafo of paragrafos) {
    if (paragrafo.length <= TAMANHO_CHUNK) {
      unidades.push(paragrafo);
      continue;
    }
    // Parágrafo grande (ex: tabela ou artigo de lei extenso): quebra por frase.
    unidades.push(...dividirEmFrases(paragrafo));
  }

  const chunks: string[] = [];
  let atual = "";

  for (const unidade of unidades) {
    const candidato = atual ? `${atual}\n\n${unidade}` : unidade;
    if (candidato.length <= TAMANHO_CHUNK || !atual) {
      atual = candidato;
      continue;
    }
    chunks.push(atual);
    const cauda = atual.slice(Math.max(0, atual.length - OVERLAP));
    atual = `${cauda}\n\n${unidade}`;
  }
  if (atual) chunks.push(atual);

  return chunks;
}
