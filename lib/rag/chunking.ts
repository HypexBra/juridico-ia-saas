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

/**
 * Alvo de tamanho do chunk PAI (parent-child chunking, ver migration 0050):
 * bloco amplo que preserva o capítulo/ementa/cláusula inteira em torno de um
 * chunk-filho, para o modelo receber o arcabouço completo em vez de um
 * parágrafo isolado sem entorno. ~6.000 caracteres (~1.600-2.000 tokens) está
 * na faixa recomendada de 1.200-2.500 tokens por bloco pai.
 */
const TAMANHO_PAI = 6_000;

export type ChunkComPai = {
  /** Chunk-filho: unidade usada na busca (precisão) — ver `dividirEmChunks`. */
  conteudo: string;
  /** Bloco pai: unidade injetada no prompt (contexto) — vários filhos compartilham o mesmo pai. */
  conteudoPai: string;
};

/**
 * Agrupa chunks-filhos consecutivos em blocos-pai de até `TAMANHO_PAI`
 * caracteres. A busca/reranking continuam operando sobre `conteudo` (filho);
 * só o texto efetivamente enviado ao modelo passa a ser `conteudoPai`.
 *
 * Quando um único filho já excede `TAMANHO_PAI` sozinho (ex: artigo de lei
 * muito extenso), ele forma um grupo próprio e `conteudoPai === conteudo` —
 * nunca pior que o comportamento anterior a esta função.
 */
export function dividirEmChunksComPai(textoBruto: string): ChunkComPai[] {
  const filhos = dividirEmChunks(textoBruto);
  if (filhos.length === 0) return [];

  const grupos: string[][] = [];
  let grupoAtual: string[] = [];
  let tamanhoGrupo = 0;

  for (const filho of filhos) {
    if (tamanhoGrupo + filho.length > TAMANHO_PAI && grupoAtual.length > 0) {
      grupos.push(grupoAtual);
      grupoAtual = [];
      tamanhoGrupo = 0;
    }
    grupoAtual.push(filho);
    tamanhoGrupo += filho.length;
  }
  if (grupoAtual.length > 0) grupos.push(grupoAtual);

  const resultado: ChunkComPai[] = [];
  for (const grupo of grupos) {
    const pai = grupo.join("\n\n");
    for (const filho of grupo) {
      resultado.push({ conteudo: filho, conteudoPai: pai });
    }
  }
  return resultado;
}
