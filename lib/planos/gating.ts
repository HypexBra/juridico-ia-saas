import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Escritorio } from "@/lib/types";

/**
 * As features premium do plano Pro (rodada separada de implementação —
 * ver CLAUDE.md deste projeto). Chave estável usada em
 * `escritorios.features_overrides` e em todo `exigirAcessoPremium(...)` /
 * `escritorioTemAcesso(...)` chamado pelo app: NUNCA renomear uma chave já
 * usada em produção sem migrar os overrides existentes.
 */
export const FEATURES_PREMIUM = [
  /** (1) Redação assistida de peças completas via IA (não só chat Q&A). */
  "redacao_assistida_pecas",
  /** (2) Análise de risco contratual clause-by-clause / "redline". */
  "analise_risco_contratual",
  /** (3) Relatórios/analytics avançados (realization rate, breakdown financeiro). */
  "relatorios_avancados",
  /** (4) Automação de documento com lógica condicional (mail-merge avançado). */
  "automacao_documento_condicional",
  /** (5) API/integrações abertas. */
  "api_integracoes",
  /** (6) Portal do cliente rico (chat bidirecional + notificação em tempo real). */
  "portal_cliente_rico",
  /**
   * (7) Análise inteligente de documento do processo — "Caso Inteligente"
   * Fase 2 (migration 0030, `analises_processo`). Ver
   * docs/adrs/0004-analise-inteligente-processos.md.
   */
  "analise_inteligente_processo",
  /**
   * (8) Document Intelligence — análise individual E em lote de documento
   * avulso (migration 0033, `analises_documento`). Mesma chave para
   * individual e lote: lote é a mesma operação repetida N vezes, não uma
   * feature de precificação distinta. Ver
   * docs/adrs/0011-document-intelligence.md, seção 7.
   */
  "analise_documento",
  /**
   * (9) Document Intelligence — comparador de documentos A x B (migration
   * 0034, `comparacoes_documento`). Chave separada de `analise_documento`
   * (não reusada) porque é operacionalmente mais cara (2x extração + prompt
   * maior) e permite limite de uso diferenciado no futuro sem tocar no gate
   * de análise individual. Ver docs/adrs/0011-document-intelligence.md,
   * seção 7.
   */
  "comparacao_documentos",
  /**
   * (10) Auditor de Peças — avaliação de peça processual (colada ou
   * upload) com notas 0-10 por dimensão (fundamentação, coerência, pedidos,
   * jurisprudência) e veredito de risco geral (migration 0035,
   * `auditorias_peca`). Pro-only sem tier gratuito parcial, mesmo padrão
   * das demais features de análise estruturada por IA. Ver
   * docs/adrs/0012-auditor-de-pecas.md, seção 7.
   */
  "auditoria_peca",
  /**
   * (11) Advogado do Contra — a IA assume a perspectiva da parte adversária
   * de uma tese/petição (colada, upload ou tese já cadastrada em
   * `teses_caso`) e produz argumentos contrários, fragilidades,
   * contradições, precedentes contrários PROVÁVEIS (hipótese da IA, nunca
   * citação jurídica verificada), pontos que precisam de prova, perguntas
   * difíceis e recomendações de reforço — sem notas numéricas agregadas
   * (migration 0039, `analises_advogado_contra`). Pro-only sem tier
   * gratuito parcial, mesmo padrão das demais features de análise
   * estruturada por IA. Ver docs/adrs/0013-advogado-do-contra.md.
   */
  "advogado_do_contra",
  /**
   * (12) Estrategista Jurídico — sintetiza teses/eventos/pessoas/
   * jurisprudência citada/análises já existentes de um caso já aberto
   * (`fichas_caso`) em objetivo, tese principal, teses subsidiárias, provas,
   * riscos, oportunidades, próximos passos e ações recomendadas (migration
   * 0041, `estrategias_caso`). Primeiro "agregador" do produto (lê múltiplas
   * fontes estruturadas em vez de um texto avulso), mas mesmo padrão
   * comercial das demais features de análise estruturada por IA: Pro-only
   * sem tier gratuito parcial. Ver docs/adrs/0014-estrategista-caso.md.
   */
  "estrategista_caso",
  /**
   * (13) Pesquisa Jurídica Avançada — a síntese da IA no Comparador de
   * Decisões (Fase 7). A BUSCA em si (lexical + semântica sobre jurisprudência)
   * e a verificação de citações são livres para todo escritório — dados
   * públicos (CC-BY STJ) não se cobram. O que se cobra é o trabalho caro de
   * IA: comparação analítica multi-decisões (teses em comum, divergências,
   * tendência, riscos).
   */
  "pesquisa_juridica_avancada",
] as const;

export type FeaturePremium = (typeof FEATURES_PREMIUM)[number];

/**
 * Matriz estática plano -> features. Decisão consciente (ver ADR
 * docs/adrs/0001-plano-gating-monolito-modular.md): com 2 planos e 6
 * features fixas, uma constante em código é mais simples de auditar/testar
 * do que uma tabela `planos_features` com join extra por request. Se algum
 * dia surgir um 3º plano ou dezenas de features, revisitar via novo ADR.
 */
const MATRIZ_PLANO_FEATURES: Record<Escritorio["plano"], ReadonlySet<FeaturePremium>> = {
  free: new Set(),
  pro: new Set(FEATURES_PREMIUM),
};

/** Subconjunto de `Escritorio` que a checagem de gating de fato precisa. */
export type EscritorioParaGating = Pick<Escritorio, "plano" | "features_overrides">;

/**
 * Versão SÍNCRONA e pura (sem I/O) da checagem de acesso — usar sempre que
 * já houver um `Escritorio` carregado em memória (ex: `usuario.perfil.escritorio`
 * vindo de `getUsuarioAtual()`, que já é cacheado por request). Preferir
 * esta função a `escritorioTemAcesso` sempre que possível: evita um
 * round-trip de rede redundante ao Supabase.
 */
export function planoTemAcesso(escritorio: EscritorioParaGating, feature: FeaturePremium): boolean {
  const override = escritorio.features_overrides?.[feature];
  if (typeof override === "boolean") return override;
  return MATRIZ_PLANO_FEATURES[escritorio.plano].has(feature);
}

/**
 * Versão ASSÍNCRONA — busca `plano`/`features_overrides` direto no banco a
 * partir do `escritorioId`. Usar apenas quando NÃO houver um `Escritorio`
 * já resolvido em memória (ex: rotas de API sem sessão de usuário completa,
 * webhooks, actions do portal do cliente que só têm `escritorio_id` via
 * `clientes_portal`/`fichas_caso`).
 *
 * Fail-closed: qualquer erro de leitura (RLS, rede, escritório inexistente)
 * resulta em `false` — nunca vaza acesso premium por falha silenciosa.
 */
export async function escritorioTemAcesso(escritorioId: string, feature: FeaturePremium): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("escritorios")
    .select("plano, features_overrides")
    .eq("id", escritorioId)
    .maybeSingle<EscritorioParaGating>();

  if (error || !data) return false;
  return planoTemAcesso(data, feature);
}

/** Erro específico para os controllers/actions traduzirem em UI de upsell. */
export class AcessoPremiumNegadoError extends Error {
  readonly feature: FeaturePremium;

  constructor(feature: FeaturePremium) {
    super(`Recurso "${feature}" disponível apenas no plano Pro.`);
    this.name = "AcessoPremiumNegadoError";
    this.feature = feature;
  }
}

/**
 * Guarda de borda para Server Actions/Route Handlers: lança
 * `AcessoPremiumNegadoError` se o escritório não tiver a feature. Chamar
 * SEMPRE no topo da action, antes de qualquer efeito colateral (chamada de
 * IA, escrita no banco, chamada a provedor externo).
 *
 * Exemplo de uso numa Server Action com o padrão `{ok, error}` já usado no
 * projeto (ver `app/app/modelos/[id]/actions.ts`):
 *
 * ```ts
 * const usuario = await getUsuarioAtual();
 * if (!usuario) return { ok: false, error: "Sessão expirada." };
 * if (!planoTemAcesso(usuario.perfil.escritorio, "redacao_assistida_pecas")) {
 *   return { ok: false, error: "Recurso disponível apenas no plano Pro." };
 * }
 * ```
 *
 * Ou, quando só se tem o `escritorioId` (rota pública/portal/API):
 *
 * ```ts
 * await exigirAcessoPremium(escritorioId, "portal_cliente_rico");
 * ```
 */
export async function exigirAcessoPremium(escritorioId: string, feature: FeaturePremium): Promise<void> {
  const permitido = await escritorioTemAcesso(escritorioId, feature);
  if (!permitido) throw new AcessoPremiumNegadoError(feature);
}
