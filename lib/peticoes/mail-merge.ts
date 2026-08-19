/**
 * Motor de mail-merge jurídico: substitui variáveis `{{variavel}}` dentro do
 * texto de um modelo (`modelos.conteudo`) pelos dados já resolvidos da ficha
 * do caso vinculada. Contrato de variáveis suportadas documentado na migration
 * 0010 (seção 2) — a sintaxe é resolvida via regex na aplicação, NUNCA no
 * banco. Função pura: não faz I/O, não conhece Supabase, só string in/string
 * out — testável isoladamente e reaproveitável em qualquer camada (server
 * action, script de exportação, etc).
 *
 * Regra de resolução: variável presente em `dados` com valor não-vazio é
 * substituída e registrada em `variaveisUsadas` (para o snapshot de auditoria
 * em `peticoes_geradas.variaveis_usadas`). Variável ausente, `null`,
 * `undefined` ou string vazia/só-espaços fica como placeholder literal no
 * texto final — nunca falha silenciosamente, é sempre reportada em
 * `variaveisNaoResolvidas` para a UI avisar o usuário antes de ele copiar/
 * baixar uma petição com lacuna.
 */

/** Nomes de variável suportados pelo contrato documentado na migration 0010. */
export const VARIAVEIS_MAIL_MERGE_SUPORTADAS = [
  "nome_cliente",
  "numero_processo",
  "area_direito",
  "valor_causa",
  "data_hoje",
] as const;

export type VariavelMailMerge = (typeof VARIAVEIS_MAIL_MERGE_SUPORTADAS)[number];

/**
 * Dados já resolvidos (pela camada de aplicação, a partir de
 * `fichas_caso`/`prazos`/`contratos_honorario`) prontos para substituição.
 * Todo campo é opcional/nulável porque nem toda ficha tem prazo vinculado com
 * número de processo, contrato de honorário com valor, etc — a ausência é
 * dado válido, não erro.
 */
export type DadosMailMerge = {
  nome_cliente?: string | null;
  numero_processo?: string | null;
  area_direito?: string | null;
  valor_causa?: string | null;
  data_hoje?: string | null;
};

export type ResultadoMailMerge = {
  /** Texto do modelo com as variáveis resolvidas substituídas. */
  textoFinal: string;
  /**
   * Snapshot só das variáveis que de fato foram substituídas (nome ->
   * valor usado) — o que vai para `peticoes_geradas.variaveis_usadas`.
   */
  variaveisUsadas: Record<string, string>;
  /**
   * Nomes de variável (sem chaves) encontrados no texto do modelo que NÃO
   * puderam ser resolvidos (typo, campo não cadastrado na ficha, ou nome de
   * variável fora do contrato suportado) — a UI deve avisar o usuário com
   * esta lista antes de considerar a petição pronta para uso.
   */
  variaveisNaoResolvidas: string[];
};

const PADRAO_VARIAVEL = /\{\{(\w+)\}\}/g;

function valorValido(valor: string | null | undefined): valor is string {
  return typeof valor === "string" && valor.trim().length > 0;
}

/**
 * Executa o mail-merge: recebe o texto bruto do modelo (com placeholders
 * `{{variavel}}`) e os dados já resolvidos, e retorna o texto final mais o
 * diagnóstico de quais variáveis foram/não foram resolvidas.
 */
export function resolverMailMerge(conteudoModelo: string, dados: DadosMailMerge): ResultadoMailMerge {
  const variaveisUsadas: Record<string, string> = {};
  const naoResolvidasSet = new Set<string>();

  const textoFinal = conteudoModelo.replace(PADRAO_VARIAVEL, (correspondenciaCompleta, nomeVariavel: string) => {
    const valor = (dados as Record<string, string | null | undefined>)[nomeVariavel];

    if (!valorValido(valor)) {
      naoResolvidasSet.add(nomeVariavel);
      // Mantém o placeholder literal — nunca substitui por string vazia,
      // que apagaria silenciosamente o rastro do que faltou preencher.
      return correspondenciaCompleta;
    }

    variaveisUsadas[nomeVariavel] = valor;
    return valor;
  });

  return {
    textoFinal,
    variaveisUsadas,
    variaveisNaoResolvidas: Array.from(naoResolvidasSet),
  };
}

/** Data corrente formatada em pt-BR (`dd/mm/aaaa`), para a variável `{{data_hoje}}`. */
export function formatarDataHojeMailMerge(data: Date = new Date()): string {
  return data.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/** Formata um valor monetário (número puro do banco) para `{{valor_causa}}` (ex: "R$ 15.000,00"). */
export function formatarValorCausaMailMerge(valor: number | null | undefined): string | null {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return null;
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
