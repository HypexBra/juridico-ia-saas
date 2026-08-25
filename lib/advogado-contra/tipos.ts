/**
 * Tipos do resultado do "Advogado do Contra" (Fase 5, ADR 0013): a IA assume
 * a perspectiva da parte ADVERSÁRIA de uma tese/petição/argumento jurídico e
 * produz achados adversariais qualitativos — nunca redige nada, só ataca a
 * tese fornecida para o próprio advogado testar a força da estratégia antes
 * de protocolar.
 *
 * Estruturalmente análogo a `lib/auditoria-peca/tipos.ts` (Fase 4), mas SEM
 * notas 0-10 por dimensão: é 100% achados adversariais qualitativos, com
 * apenas um veredito categórico final de "vulnerabilidade"
 * (`vulnerabilidadeGeral`/`justificativaVulnerabilidade`, mesmo espírito de
 * `veredictoRisco`/`justificativaRisco` do Auditor, renomeado para o domínio
 * adversarial).
 *
 * `CitacaoAnaliseProcesso` é reaproveitada de `lib/analise-processo/tipos.ts`
 * (ADR 0004) — mesmo contrato de rastreabilidade (`trechoOriginal`/`pagina`/
 * `certeza`) já usado por Document Intelligence (ADR 0011) e Auditor de
 * Peças (ADR 0012).
 */
import type { CitacaoAnaliseProcesso, NivelCertezaAnaliseProcesso } from "../analise-processo/tipos";

export type { CitacaoAnaliseProcesso, NivelCertezaAnaliseProcesso };

/** Força de um argumento/precedente — qualitativa, nunca numérica. */
export const FORCAS_ARGUMENTO_CONTRA = ["baixa", "media", "alta"] as const;
export type ForcaArgumento = (typeof FORCAS_ARGUMENTO_CONTRA)[number];

export const CATEGORIAS_FRAGILIDADE = [
  "fundamentacao",
  "fatos",
  "provas",
  "pedidos",
  "argumentacao",
  "inconsistencia",
  "clareza",
  "estrutura",
] as const;
export type CategoriaFragilidade = (typeof CATEGORIAS_FRAGILIDADE)[number];

export const SEVERIDADES_FRAGILIDADE = ["leve", "moderada", "grave"] as const;
export type SeveridadeFragilidade = (typeof SEVERIDADES_FRAGILIDADE)[number];

/** Veredito categórico final — NUNCA nota numérica (diferente do Auditor de
 * Peças, esta feature não pontua nada 0-10; é 100% achado qualitativo). */
export const VULNERABILIDADES = ["baixa", "media", "alta"] as const;
export type Vulnerabilidade = (typeof VULNERABILIDADES)[number];

/** Contra-argumento que a parte adversária provavelmente levantaria contra a
 * tese — extraído/embasado no texto fornecido, por isso mantém o contrato de
 * citação (`trechoOriginal`/`pagina`/`certeza`). */
export type ArgumentoContrario = CitacaoAnaliseProcesso & {
  descricao: string;
  forca: ForcaArgumento;
};

/** Ponto fraco identificado NA PRÓPRIA tese/peça fornecida — categoria
 * própria, distinta de `ArgumentoContrario` (que é o que o adversário diria),
 * é o que o adversário poderia EXPLORAR. */
export type Fragilidade = CitacaoAnaliseProcesso & {
  categoria: CategoriaFragilidade;
  severidade: SeveridadeFragilidade;
  descricao: string;
  /** Ajuste concreto sugerido para reduzir a fragilidade, ou `null` quando
   * não há reforço óbvio a propor (ex.: fragilidade "leve" só documentada). */
  sugestaoReforco: string | null;
};

/** Inconsistência interna detectada na tese/peça (contradição entre trechos,
 * entre pedido e fundamentação, etc.) — categoria própria, distinta de
 * fragilidade pontual. */
export type Contradicao = CitacaoAnaliseProcesso & {
  descricao: string;
};

/**
 * Hipótese de entendimento jurisprudencial/doutrinário CONTRÁRIO à tese —
 * PROPOSITALMENTE não estende `CitacaoAnaliseProcesso` (sem `trechoOriginal`/
 * `pagina`/`certeza`): é uma hipótese sobre algo EXTERNO ao texto fornecido,
 * não uma citação extraída dele, então não faz sentido fingir rastreabilidade
 * a uma página que não existe. Guardrail crítico anti-alucinação em
 * `lib/advogado-contra/prompt.ts` (regex CNJ + instrução reforçada): a IA
 * NUNCA pode inventar número de processo, relator, data de julgamento ou
 * súmula/tribunal específicos aqui — só o TIPO de entendimento provável.
 */
export type PrecedenteContrarioProvavel = {
  descricao: string;
  areaJuridicaProvavel: string | null;
  forca: ForcaArgumento;
};

/**
 * Resultado completo do Advogado do Contra — pedido ao Gemini via
 * `RESPONSE_SCHEMA` (`lib/advogado-contra/prompt.ts`) e persistido em
 * `analises_advogado_contra.resultado_advogado_contra` (jsonb). Sem notas
 * numéricas em nenhum campo — só `vulnerabilidadeGeral` categórico, mesmo
 * espírito de `veredictoRisco` do Auditor de Peças.
 */
export type ResultadoAdvogadoContra = {
  teseIdentificada: string;
  resumoExecutivo: string;
  /** Mínimo 1 — uma chamada sem NENHUM contra-argumento é resposta
   * degenerada (guardrail em código, não só instrução). */
  argumentosContrarios: ArgumentoContrario[];
  fragilidades: Fragilidade[];
  contradicoes: Contradicao[];
  precedentesContrariosProvaveis: PrecedenteContrarioProvavel[];
  /** Sem citação — pontos que a tese/peça assume mas não comprova, o espaço
   * certo para isso em vez de forçar uma "fragilidade" com suposição. */
  pontosQueExigemProva: string[];
  /** Perguntas difíceis que um juiz/desembargador poderia fazer ao
   * sustentar essa tese — sem citação, formulação livre. */
  perguntasDificeis: string[];
  /** Recomendações concretas para fortalecer a tese antes de protocolar —
   * sem citação, formulação livre. */
  recomendacoesFortalecimento: string[];
  vulnerabilidadeGeral: Vulnerabilidade;
  justificativaVulnerabilidade: string;
};
