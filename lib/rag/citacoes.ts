/**
 * Validação DETERMINÍSTICA de citação: o modelo é instruído (RAG_TOOLING_PROMPT)
 * a marcar toda afirmação embasada no contexto recuperado com "[Doc #N]" — N
 * referenciando a posição do trecho no bloco montado por
 * `lib/rag/retrieval.ts#montarBlocoContexto`. Como o texto é gerado por um
 * modelo não confiável, "citou [Doc #N]" não é garantia de que N exista de
 * verdade; esta função checa isso sem nenhuma chamada de IA — é aritmética
 * sobre o texto e o total de chunks efetivamente injetados no prompt.
 *
 * Função pura: não decide o que fazer com uma citação inválida (bloquear,
 * logar, remover) — isso é responsabilidade de quem chama, por rota.
 */

export function extrairCitacoesDoc(texto: string): number[] {
  const encontrados = [...texto.matchAll(/\[Doc\s*#(\d+)\]/gi)].map((m) => Number(m[1]));
  return [...new Set(encontrados)];
}

export type ResultadoValidacaoCitacoes = {
  /** Números de [Doc #N] citados que existem no bloco de contexto (1..totalChunks). */
  validas: number[];
  /** Números citados que NÃO existem — o modelo inventou uma referência. */
  invalidas: number[];
};

export function validarCitacoes(texto: string, totalChunks: number): ResultadoValidacaoCitacoes {
  const citadas = extrairCitacoesDoc(texto);
  if (totalChunks === 0) {
    // Sem contexto nenhum injetado nesta mensagem: QUALQUER "[Doc #N]" citado
    // é necessariamente inventado (não há prompt para ele apontar).
    return { validas: [], invalidas: citadas };
  }
  return {
    validas: citadas.filter((n) => n >= 1 && n <= totalChunks),
    invalidas: citadas.filter((n) => n < 1 || n > totalChunks),
  };
}
