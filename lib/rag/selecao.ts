/**
 * SELEÇÃO DE CHUNKS · o que efetivamente entra no prompt depois da busca
 * vetorial. Função pura (zero I/O), aplicada por `buscarContextoRelevante`.
 *
 * O retrieval anterior fazia: corte por distância absoluta (<= 0.7), teto de
 * 4 chunks por fonte_tipo, top-6. Três problemas de custo/qualidade que isso
 * não resolve:
 *
 * 1. CORTE ABSOLUTO NÃO SEPARA "bom" DE "menos ruim". Se o melhor chunk vem a
 *    0.22 e o sexto a 0.68, os dois passam no corte de 0.7 · mas o sexto não
 *    tem relação real com a pergunta, e ainda assim ocupa ~450 tokens de
 *    prompt em toda mensagem. Um corte RELATIVO ao melhor resultado resolve:
 *    o que está muito atrás do primeiro colocado é ruído, independentemente
 *    do número absoluto.
 * 2. SEM DEDUPLICAÇÃO DE CONTEÚDO. `lib/rag/chunking.ts` gera chunks com 200
 *    caracteres de sobreposição de propósito (não cortar frase no meio).
 *    Dois chunks vizinhos da mesma fonte são, portanto, parcialmente o mesmo
 *    texto · e ambos costumam pontuar parecido na mesma pergunta. Pagar
 *    tokens duas vezes pelo mesmo parágrafo é desperdício puro.
 * 3. SEM TETO DE TAMANHO. 6 chunks × 1800 caracteres = até ~10.800 chars
 *    (~3.000 tokens) injetados em TODA mensagem não-trivial, mesmo quando 2
 *    chunks já respondiam. O orçamento em caracteres é o que dá previsibilidade
 *    de custo por mensagem.
 *
 * Nenhum desses filtros pode ficar "esperto" a ponto de descartar o chunk
 * certo: a ordem é sempre por relevância, e o primeiro colocado NUNCA é
 * descartado por orçamento (ver `selecionarChunks`).
 */

export type ChunkSelecionavel = {
  fonteTipo: string;
  fonteId: string;
  conteudo: string;
  distancia: number;
};

export type OpcoesSelecao = {
  /** Teto de chunks no resultado final. */
  topK: number;
  /** Teto de chunks do mesmo `fonteTipo` (diversidade de fonte). */
  maxPorFonte: number;
  /** Corte absoluto de relevância: distância de cosseno acima disso é ruído. */
  distanciaMaxima: number;
  /**
   * Corte RELATIVO: descarta o chunk cuja distância excede
   * `melhorDistancia + margemRelativa`. 0.18 em distância de cosseno é a
   * faixa em que um resultado deixa de ser "o mesmo assunto" e passa a ser
   * "assunto vizinho" · calibrado para ser generoso o bastante a ponto de
   * nunca cortar um segundo chunk legitimamente útil.
   */
  margemRelativa: number;
  /** Orçamento total de caracteres de conteúdo somado. */
  orcamentoChars: number;
  /**
   * Acima deste grau de sobreposição de texto com um chunk JÁ selecionado, o
   * candidato é considerado redundante e descartado. 0.6 cobre o overlap
   * de 200 chars entre chunks vizinhos sem descartar dois trechos distintos
   * que apenas compartilham vocabulário jurídico comum.
   */
  sobreposicaoMaxima: number;
};

export const SELECAO_PADRAO: OpcoesSelecao = {
  topK: 6,
  maxPorFonte: 4,
  distanciaMaxima: 0.7,
  margemRelativa: 0.18,
  orcamentoChars: 6_000,
  sobreposicaoMaxima: 0.6,
};

/**
 * Conjunto de shingles de 5 palavras (5-grams). Palavra, não caractere:
 * shingle de caractere acusaria semelhança alta entre quaisquer dois textos
 * jurídicos em português (mesmas desinências, mesmos conectivos), o que
 * descartaria chunks distintos. 5 palavras seguidas iguais já indicam texto
 * de fato repetido.
 */
function shingles(texto: string): Set<string> {
  const palavras = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

  const conjunto = new Set<string>();
  for (let i = 0; i + 5 <= palavras.length; i++) {
    conjunto.add(palavras.slice(i, i + 5).join(" "));
  }
  return conjunto;
}

/**
 * Grau de sobreposição do candidato em relação ao já selecionado: fração dos
 * shingles do CANDIDATO que já aparecem no outro texto.
 *
 * Assimétrico de propósito (não é Jaccard): o que interessa é "quanto deste
 * candidato é novidade", não "quão parecidos os dois são". Um chunk curto
 * inteiramente contido num chunk longo tem sobreposição 1.0 aqui e ~0.3 em
 * Jaccard · e ele é justamente o que deve ser descartado.
 */
export function sobreposicaoTextual(candidato: string, jaSelecionado: string): number {
  const a = shingles(candidato);
  if (a.size === 0) return 0;
  const b = shingles(jaSelecionado);
  if (b.size === 0) return 0;

  let comuns = 0;
  for (const s of a) if (b.has(s)) comuns++;
  return comuns / a.size;
}

export type ResultadoSelecao<T extends ChunkSelecionavel> = {
  selecionados: T[];
  /** Contadores para observabilidade: quanto cada filtro descartou nesta busca. */
  descartes: {
    porDistanciaAbsoluta: number;
    porMargemRelativa: number;
    porRedundancia: number;
    porOrcamento: number;
    porTetoDeFonte: number;
  };
  charsUsados: number;
};

/**
 * Aplica, nesta ordem: corte absoluto -> corte relativo ao melhor -> teto por
 * fonte -> deduplicação por sobreposição -> orçamento de caracteres.
 *
 * Espera `candidatos` JÁ ordenados por distância crescente (é como a RPC
 * `buscar_chunks_similares` devolve). Reordena por garantia, mas não recalcula
 * relevância · isso é trabalho do pgvector, não daqui.
 */
export function selecionarChunks<T extends ChunkSelecionavel>(
  candidatos: readonly T[],
  opcoes: OpcoesSelecao = SELECAO_PADRAO,
): ResultadoSelecao<T> {
  const descartes = {
    porDistanciaAbsoluta: 0,
    porMargemRelativa: 0,
    porRedundancia: 0,
    porOrcamento: 0,
    porTetoDeFonte: 0,
  };

  const ordenados = [...candidatos].sort((a, b) => a.distancia - b.distancia);

  const relevantes = ordenados.filter((c) => {
    if (c.distancia > opcoes.distanciaMaxima) {
      descartes.porDistanciaAbsoluta++;
      return false;
    }
    return true;
  });

  if (relevantes.length === 0) {
    return { selecionados: [], descartes, charsUsados: 0 };
  }

  const melhorDistancia = relevantes[0].distancia;
  const limiteRelativo = melhorDistancia + opcoes.margemRelativa;

  const noCorte = relevantes.filter((c, indice) => {
    // O primeiro colocado nunca é cortado por margem relativa (ele DEFINE a
    // margem); a comparação vale só para os demais.
    if (indice > 0 && c.distancia > limiteRelativo) {
      descartes.porMargemRelativa++;
      return false;
    }
    return true;
  });

  const selecionados: T[] = [];
  const porTipo = new Map<string, number>();
  let charsUsados = 0;

  for (const candidato of noCorte) {
    if (selecionados.length >= opcoes.topK) break;

    const usadosDoTipo = porTipo.get(candidato.fonteTipo) ?? 0;
    if (usadosDoTipo >= opcoes.maxPorFonte) {
      descartes.porTetoDeFonte++;
      continue;
    }

    const redundante = selecionados.some(
      (ja) => sobreposicaoTextual(candidato.conteudo, ja.conteudo) >= opcoes.sobreposicaoMaxima,
    );
    if (redundante) {
      descartes.porRedundancia++;
      continue;
    }

    // O primeiro colocado entra mesmo se sozinho já estourar o orçamento:
    // devolver contexto vazio porque o chunk mais relevante é grande seria
    // pior que estourar o teto em uma mensagem.
    const cabeNoOrcamento = charsUsados + candidato.conteudo.length <= opcoes.orcamentoChars;
    if (!cabeNoOrcamento && selecionados.length > 0) {
      descartes.porOrcamento++;
      continue;
    }

    selecionados.push(candidato);
    porTipo.set(candidato.fonteTipo, usadosDoTipo + 1);
    charsUsados += candidato.conteudo.length;
  }

  return { selecionados, descartes, charsUsados };
}
