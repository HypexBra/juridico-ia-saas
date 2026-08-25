/**
 * Montagem PURA (sem I/O) do bloco de contexto enviado à IA do Estrategista
 * Jurídico (ADR 0014, seção 4). Recebe os dados JÁ BUSCADOS do banco — a
 * query real que lê `fichas_caso`/`teses_caso`/`eventos_caso`/`pessoas_caso`/
 * `caso_jurisprudencia_citada`/`analises_processo`/`analises_documento` vive
 * na Onda 2 (`app/app/fichas/[id]/estrategia-actions.ts`), fora deste
 * módulo — mesma separação de I/O e lógica pura já usada em
 * `lib/rag/retrieval.ts` (busca) vs. `montarBlocoContexto` (montagem de
 * texto), e em `lib/casos/teses.ts` (funções puras de payload).
 *
 * Ordem de prioridade e teto de tamanho seguem literalmente o ADR 0014,
 * seção 4: corta por SEÇÃO INTEIRA (nunca no meio de uma tese/evento) quando
 * o teto agregado é atingido, na ordem: ficha -> teses -> últimos N eventos
 * -> pessoas -> jurisprudência citada -> resumos de análises -> campos
 * legados da ficha (fallback de baixa prioridade, cortado primeiro).
 */

export type StatusProcessualContextoEstrategia = "em_andamento" | "ganho" | "acordo" | "perdido" | "arquivado" | null;

export type FichaContextoEstrategia = {
  resumoFatos: string | null;
  areaDireito: string | null;
  urgencia: "baixa" | "normal" | "alta";
  statusProcessual: StatusProcessualContextoEstrategia;
  /** Campos legados (ADR 0014, seção 4, item 7) — só entram como fallback de
   * baixa prioridade, nunca como fonte primária. */
  resumoIa: string | null;
  questoesIa: string | null;
  estrategiaIa: string | null;
};

export type TeseContextoEstrategia = {
  id: string;
  tese: string;
  fundamentacao: string | null;
  status: "em_avaliacao" | "adotada" | "descartada";
  atualizadoEm: string;
};

export type EventoContextoEstrategia = {
  id: string;
  tipoEvento: string;
  descricao: string;
  dataEvento: string;
};

export type PessoaContextoEstrategia = {
  id: string;
  tipo: "parte" | "adverso" | "testemunha" | "terceiro";
  nome: string;
  papelProcessual: string | null;
};

export type JurisprudenciaCitadaContextoEstrategia = {
  id: string;
  tribunal: string;
  numeroProcesso: string;
  ementa: string;
  notaAdvogado: string | null;
};

export type AnaliseResumoContextoEstrategia = {
  id: string;
  tipo: "analise_processo" | "analise_documento";
  resumoExecutivo: string;
  criadoEm: string;
};

/** Dados já buscados do banco (mesmo shape recebido por
 * `gerarEstrategiaCaso`, `lib/estrategia-caso/gerar.ts`). */
export type DadosContextoEstrategiaCaso = {
  ficha: FichaContextoEstrategia;
  teses: TeseContextoEstrategia[];
  eventos: EventoContextoEstrategia[];
  pessoas: PessoaContextoEstrategia[];
  jurisprudenciasCitadas: JurisprudenciaCitadaContextoEstrategia[];
  resumosAnalises: AnaliseResumoContextoEstrategia[];
};

/** Teto agregado de caracteres do contexto (ADR 0014, seção 4) — entre o
 * teto de peça avulsa do Auditor (60k) e o teto de documento extraído
 * (300k), porque a entrada aqui é estruturada/pré-resumida por natureza. */
export const TAMANHO_MAXIMO_CONTEXTO_ESTRATEGIA = 120_000;

/** Quantidade de eventos mais recentes considerados (ADR 0014, seção 4,
 * item 3) — não a linha do tempo inteira de um caso longevo. */
export const MAXIMO_EVENTOS_CONTEXTO_ESTRATEGIA = 30;

function montarSecaoFicha(ficha: FichaContextoEstrategia): string {
  const linhas = [
    "=== FICHA DO CASO ===",
    `Área do direito: ${ficha.areaDireito?.trim() || "não informada"}`,
    `Urgência: ${ficha.urgencia}`,
    `Status processual: ${ficha.statusProcessual ?? "não informado"}`,
    `Resumo dos fatos: ${ficha.resumoFatos?.trim() || "não informado"}`,
  ];
  return linhas.join("\n");
}

function montarSecaoTeses(teses: TeseContextoEstrategia[]): string | null {
  if (teses.length === 0) return null;

  const ordenadas = [...teses].sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm));
  const blocos = ordenadas.map(
    (tese) =>
      `- [id: ${tese.id}] (${tese.status}) ${tese.tese}${tese.fundamentacao ? `\n  Fundamentação: ${tese.fundamentacao}` : ""}`,
  );
  return `=== TESES JÁ CADASTRADAS DO CASO (use o "id" ao referenciar uma tese existente) ===\n${blocos.join("\n")}`;
}

function montarSecaoEventos(eventos: EventoContextoEstrategia[]): string | null {
  if (eventos.length === 0) return null;

  const recentes = [...eventos]
    .sort((a, b) => b.dataEvento.localeCompare(a.dataEvento))
    .slice(0, MAXIMO_EVENTOS_CONTEXTO_ESTRATEGIA);
  const blocos = recentes.map((evento) => `- [id: ${evento.id}] ${evento.dataEvento} (${evento.tipoEvento}): ${evento.descricao}`);
  return `=== ÚLTIMOS EVENTOS DA LINHA DO TEMPO (mais recentes primeiro, máx. ${MAXIMO_EVENTOS_CONTEXTO_ESTRATEGIA}) ===\n${blocos.join("\n")}`;
}

function montarSecaoPessoas(pessoas: PessoaContextoEstrategia[]): string | null {
  if (pessoas.length === 0) return null;

  const blocos = pessoas.map(
    (pessoa) => `- [id: ${pessoa.id}] ${pessoa.nome} (${pessoa.tipo}${pessoa.papelProcessual ? `, ${pessoa.papelProcessual}` : ""})`,
  );
  return `=== PESSOAS ENVOLVIDAS NO CASO ===\n${blocos.join("\n")}`;
}

function montarSecaoJurisprudencias(jurisprudencias: JurisprudenciaCitadaContextoEstrategia[]): string | null {
  if (jurisprudencias.length === 0) return null;

  const blocos = jurisprudencias.map(
    (item) =>
      `- [id: ${item.id}] ${item.tribunal.toUpperCase()} ${item.numeroProcesso}: ${item.ementa}${item.notaAdvogado ? `\n  Nota do advogado: ${item.notaAdvogado}` : ""}`,
  );
  return `=== JURISPRUDÊNCIA JÁ CITADA NO CASO ===\n${blocos.join("\n")}`;
}

function montarSecaoResumosAnalises(resumos: AnaliseResumoContextoEstrategia[]): string | null {
  if (resumos.length === 0) return null;

  const recentes = [...resumos].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  const blocos = recentes.map((resumo) => `- [id: ${resumo.id}] (${resumo.tipo}) ${resumo.resumoExecutivo}`);
  return `=== RESUMOS DE ANÁLISES DE IA JÁ REALIZADAS SOBRE ESTE CASO ===\n${blocos.join("\n")}`;
}

function montarSecaoLegado(ficha: FichaContextoEstrategia): string | null {
  const temAlgo = ficha.resumoIa?.trim() || ficha.questoesIa?.trim() || ficha.estrategiaIa?.trim();
  if (!temAlgo) return null;

  const linhas = [
    "=== CONTEXTO LEGADO DE BAIXA PRIORIDADE (pipeline antigo, use só como sinal adicional) ===",
    ficha.resumoIa?.trim() ? `Resumo (legado): ${ficha.resumoIa.trim()}` : null,
    ficha.questoesIa?.trim() ? `Questões (legado): ${ficha.questoesIa.trim()}` : null,
    ficha.estrategiaIa?.trim() ? `Estratégia sugerida (legado): ${ficha.estrategiaIa.trim()}` : null,
  ].filter((linha): linha is string => linha !== null);

  return linhas.join("\n");
}

/**
 * Monta o texto final de contexto respeitando `TAMANHO_MAXIMO_CONTEXTO_ESTRATEGIA`
 * e a ordem de prioridade da seção 4 do ADR 0014. Corta por SEÇÃO INTEIRA:
 * cada seção só entra no resultado se, adicionada, o texto acumulado não
 * ultrapassar o teto — nunca corta o meio de uma tese/evento/etc. A ficha
 * (seção 1, sempre incluída) nunca é cortada mesmo que já exceda o teto
 * sozinha (é curta por natureza e é o núcleo mínimo do caso).
 */
export function montarContextoEstrategiaCaso(
  dados: DadosContextoEstrategiaCaso,
  tamanhoMaximo: number = TAMANHO_MAXIMO_CONTEXTO_ESTRATEGIA,
): string {
  const secaoFicha = montarSecaoFicha(dados.ficha);

  const secoesPriorizadas = [
    montarSecaoTeses(dados.teses),
    montarSecaoEventos(dados.eventos),
    montarSecaoPessoas(dados.pessoas),
    montarSecaoJurisprudencias(dados.jurisprudenciasCitadas),
    montarSecaoResumosAnalises(dados.resumosAnalises),
    montarSecaoLegado(dados.ficha),
  ].filter((secao): secao is string => secao !== null);

  const blocosIncluidos = [secaoFicha];
  let tamanhoAcumulado = secaoFicha.length;

  for (const secao of secoesPriorizadas) {
    const tamanhoComSeparador = secao.length + 2; // "\n\n"
    // Para no primeiro estouro (não pula pra tentar encaixar uma seção de
    // prioridade MENOR mais à frente) — garante que tudo cortado é sempre de
    // prioridade igual ou menor que a última seção incluída, respeitando a
    // ordem de prioridade da seção 4 do ADR 0014 (nunca "cutucar" o teto
    // fora de ordem só porque uma seção posterior é pequena o suficiente).
    if (tamanhoAcumulado + tamanhoComSeparador > tamanhoMaximo) break;
    blocosIncluidos.push(secao);
    tamanhoAcumulado += tamanhoComSeparador;
  }

  return blocosIncluidos.join("\n\n");
}
