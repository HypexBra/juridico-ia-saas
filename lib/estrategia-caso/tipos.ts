/**
 * Tipos do resultado do "Estrategista Jurídico" (Fase 6, ADR 0014): a IA
 * sintetiza tudo que já existe sobre um caso (`fichas_caso`) já aberto —
 * teses, eventos, pessoas, jurisprudência citada, resumos de análises de
 * documento/processo — e produz objetivo, teses (principal + subsidiárias),
 * provas necessárias/disponíveis, riscos, oportunidades, próximos passos e
 * ações recomendadas.
 *
 * Primeiro "agregador" do produto: as 5 features anteriores (Auditor de
 * Peças, Advogado do Contra, Document Intelligence, Análise de Processo,
 * Redline) analisam um ÚNICO texto/documento avulso; aqui a entrada é a
 * SOMA de múltiplas fontes estruturadas de várias tabelas relacionais.
 *
 * Copiado literalmente do shape decidido em `docs/adrs/0014-estrategista-caso.md`,
 * seção 3 — não redesenhar.
 */

export const CATEGORIAS_RISCO_ESTRATEGIA = [
  "prazo",
  "prova",
  "jurisprudencia",
  "fundamentacao",
  "processual",
  "financeiro",
  "reputacional",
] as const;
export type CategoriaRiscoEstrategia = (typeof CATEGORIAS_RISCO_ESTRATEGIA)[number];

export const NIVEIS_RISCO_ESTRATEGIA = ["baixo", "medio", "alto"] as const;
export type NivelRiscoEstrategia = (typeof NIVEIS_RISCO_ESTRATEGIA)[number];

/** Origem da recomendação — rastreabilidade LEVE, não citação literal (ver
 * ADR 0014, seção 3, justificativa de não reaproveitar `CitacaoAnaliseProcesso`). */
export type OrigemContextoEstrategia =
  | { tipo: "tese"; teseCasoId: string }
  | { tipo: "evento"; eventoCasoId: string }
  | { tipo: "analise_documento"; analiseDocumentoId: string }
  | { tipo: "analise_processo"; analiseProcessoId: string }
  | { tipo: "ficha" }; // fatos-base da própria ficha, sem id de fonte adicional

export type RiscoEstrategiaCaso = {
  categoria: CategoriaRiscoEstrategia;
  nivel: NivelRiscoEstrategia;
  descricao: string;
  origem: OrigemContextoEstrategia[];
};

export type OportunidadeEstrategiaCaso = {
  descricao: string;
  origem: OrigemContextoEstrategia[];
};

export type ProvaEstrategiaCaso = {
  descricao: string;
  status: "disponivel" | "necessaria";
  /** Só relevante quando `status === "disponivel"` — aponta pra onde a prova já foi
   * identificada (ex.: evento da linha do tempo, análise de documento). */
  origem: OrigemContextoEstrategia[];
};

/** Desenhado para virar 1 tarefa em `tarefas_caso` com um clique — o shape
 * espelha `NovaTarefaCasoFormInput` (`lib/casos/tarefas.ts`) de propósito:
 * `titulo` -> `titulo`, `prazoSugerido` -> `prazoOpcional`. */
export type ProximoPassoEstrategiaCaso = {
  titulo: string;
  detalhe: string | null;
  prazoSugerido: string | null; // YYYY-MM-DD, estimativa relativa da IA — nunca prazo processual formal
  prioridade: "baixa" | "media" | "alta";
  origem: OrigemContextoEstrategia[];
};

/** "Ações recomendadas" — mesma finalidade prática de "próximo passo" (também
 * conversível em tarefa), mas de natureza estratégica/estrutural em vez de
 * operacional (ex.: "considerar acordo" vs. "solicitar comprovante de residência
 * atualizado"). Categorias distintas de produto, mesmo shape de conversão. */
export type AcaoRecomendadaEstrategiaCaso = ProximoPassoEstrategiaCaso;

/**
 * Tese principal/subsidiária do resultado — REFERÊNCIA a uma tese já
 * cadastrada em `teses_caso` por padrão (`origem: "tese_cadastrada"`), com
 * fallback de texto livre (`origem: "sugerida"`) só quando nenhuma tese
 * cadastrada for semanticamente equivalente (ADR 0014, seção 2). O prompt
 * instrui a IA a SEMPRE tentar casar antes de propor uma tese nova.
 */
export type TeseEstrategiaCaso =
  | { origem: "tese_cadastrada"; teseCasoId: string; papel: "principal" | "subsidiaria" }
  | { origem: "sugerida"; papel: "principal" | "subsidiaria"; tese: string; fundamentacao: string };

export type ResultadoEstrategiaCaso = {
  objetivo: string;
  teses: TeseEstrategiaCaso[]; // 1 principal + N subsidiárias (papel discrimina)
  provas: ProvaEstrategiaCaso[];
  riscos: RiscoEstrategiaCaso[];
  oportunidades: OportunidadeEstrategiaCaso[];
  proximosPassos: ProximoPassoEstrategiaCaso[];
  acoesRecomendadas: AcaoRecomendadaEstrategiaCaso[];
  ressalvas: string[]; // lacunas de contexto que limitam a confiança da estratégia (ver ADR 0014, seção 4)
};
