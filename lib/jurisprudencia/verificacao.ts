import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * VERIFICADOR DE CITAÇÕES — guardrail da Fase 7 (Pesquisa Jurídica
 * Verificável). Regra de produto do projeto: a IA NUNCA pode inventar
 * jurisprudência. Este módulo extrai citações jurídicas de um texto gerado
 * por IA (ou digitado) e confere CADA UMA contra a base local
 * `jurisprudencias` (alimentada pelos dados abertos oficiais do STJ +
 * ingestão manual), classificando:
 *
 *   - VERIFICADA: o número existe na base local → devolve metadados oficiais
 *     (relator, órgão, classe, data, link) para exibição junto ao trecho.
 *   - NAO_VERIFICADA: padrão bem-formado mas não encontrada na base → o usuário
 *     vê explicitamente que a fonte NÃO foi confirmada (nunca silenciar).
 *   - MAL_FORMADA: parece número de processo mas não passa na validação de
 *     dígito CNJ → bandeira vermelha.
 *
 * IMPORTANTE: "não verificada" ≠ "falsa". A base local é um subconjunto dos
 * acórdãos publicados (espelhos mensais STJ + cadastros manuais) — uma
 * citação real pode não estar na base ainda. Por isso o veredito é sempre
 * apresentado como status de VERIFICAÇÃO LOCAL, não como juízo de verdade.
 */

export const REGEX_PROCESSO_CNJ = /\b(\d{7}-?\d{2}\.\d{4}\.\d{1}\.\d{2}\.\d{4})\b/g;
/** REsp / AgRg / EDcl etc.: sigla + espaço + nº sequencial (formato canônico STJ). */
export const REGEX_NUMERO_STJ =
  /\b(REsp|AgInt|AgRg|EDcl|EDecl|RMS|RE|AI|HC|CC|MS|SD|SS|Sl|AR|AREsp|ROMS|MC)\s+n?\s?([\d.]{6,14}-?\d{0,2})\b/g;
export const REGEX_SUMULA = /\bS[uú]mula\s+n?[ºo°]?\s*(\d{1,4})\b/gi;
export const REGEX_TEMA = /\bTema\s+n?[ºo°]?\s*(\d{1,3})\s*(?:do STJ|repetitivo)?/gi;

/**
 * Valida o dígito verificador do padrão CNJ (Resolução 65/CNJ, ISO 7064
 * MOD 97-10). Layout dos 20 dígitos:
 *   NNNNNNN(0-6) · DD(7-8) · AAAA(9-12) · J(13) · TR(14-15) · OOOO(16-19)
 * DV = 98 - ((NNNNNNN + AAAA+J+TR+OOOO + '00') mod 97).
 */
export function digitoVerificadorCnjValido(numero: string): boolean {
  const limpo = numero.replace(/\D/g, "");
  if (limpo.length !== 20 || /^0+$/.test(limpo)) return false;
  const baseStr = `${limpo.slice(0, 7)}${limpo.slice(9)}00`;
  const dvDeclarado = Number.parseInt(limpo.slice(7, 9), 10);
  let resto = 0;
  for (const digito of baseStr) {
    resto = (resto * 10 + Number.parseInt(digito, 10)) % 97;
  }
  return dvDeclarado === 98 - resto;
}

export type CitacaoExtraida = {
  tipo: "processo_cnj" | "numero_stj" | "sumula" | "tema";
  valor: string;
};

/** Extrai todas as citações reconhecíveis do texto (deduplicadas). */
export function extrairCitacoes(texto: string): CitacaoExtraida[] {
  const citacoes: CitacaoExtraida[] = [];
  const vistas = new Set<string>();
  const push = (tipo: CitacaoExtraida["tipo"], valor: string) => {
    const chave = `${tipo}:${valor}`;
    if (!vistas.has(chave)) {
      vistas.add(chave);
      citacoes.push({ tipo, valor });
    }
  };

  for (const m of texto.matchAll(REGEX_PROCESSO_CNJ)) push("processo_cnj", m[1]);
  for (const m of texto.matchAll(REGEX_NUMERO_STJ)) push("numero_stj", `${m[1]} ${m[2]}`);
  for (const m of texto.matchAll(REGEX_SUMULA)) push("sumula", m[1]);
  for (const m of texto.matchAll(REGEX_TEMA)) push("tema", m[1]);

  return citacoes;
}

export type CitacaoVerificada = CitacaoExtraida & {
  status: "verificada" | "nao_verificada" | "mal_formada";
  detalhe?: {
    tribunal?: string;
    numeroProcesso?: string;
    classe?: string;
    relator?: string;
    orgaoJulgador?: string;
    dataJulgamento?: string | null;
    tese?: string | null;
    tema?: number | null;
  };
};

type JurisprudenciaRow = {
  id: string;
  tribunal: string;
  numero_processo: string;
  classe: string | null;
  relator: string | null;
  orgao_julgador: string | null;
  data_julgamento: string | null;
  tese: string | null;
  tema: number | null;
};

/**
 * Verifica todas as citações do texto contra a base local `jurisprudencias`.
 * Consulta em LOTE (um SELECT com .in() por tipo presente) — nunca uma query
 * por citação, para manter a latência do pós-processamento desprezível.
 */
export async function verificarCitacoes(
  supabase: SupabaseClient,
  texto: string,
): Promise<CitacaoVerificada[]> {
  const extraidas = extrairCitacoes(texto);
  if (extraidas.length === 0) return [];

  const processosCnj = extraidas.filter((c) => c.tipo === "processo_cnj").map((c) => c.valor);
  const temas = extraidas.filter((c) => c.tipo === "tema").map((c) => Number.parseInt(c.valor, 10));

  const porProcesso = new Map<string, JurisprudenciaRow>();
  const porTema = new Map<number, JurisprudenciaRow>();

  // Normaliza o nº CNJ para comparação (a base guarda sem pontuação às vezes).
  const variantes = (n: string) => [n, n.replace(/\D/g, "")];

  if (processosCnj.length > 0) {
    const candidatos = [...new Set(processosCnj.flatMap(variantes))];
    const { data } = await supabase
      .from("jurisprudencias")
      .select(
        "id, tribunal, numero_processo, classe, relator, orgao_julgador, data_julgamento, tese, tema",
      )
      .in("numero_processo", candidatos)
      .limit(50);
    for (const row of (data ?? []) as JurisprudenciaRow[]) porProcesso.set(row.numero_processo, row);
  }

  if (temas.length > 0) {
    const { data } = await supabase
      .from("jurisprudencias")
      .select("id, tribunal, numero_processo, classe, relator, orgao_julgador, data_julgamento, tese, tema")
      .in("tema", temas)
      .limit(50);
    for (const row of (data ?? []) as JurisprudenciaRow[]) {
      if (row.tema != null) porTema.set(row.tema, row);
    }
  }

  return extraidas.map((citacao): CitacaoVerificada => {
    if (citacao.tipo === "processo_cnj") {
      const achado =
        porProcesso.get(citacao.valor) ??
        variantes(citacao.valor)
          .map((v) => porProcesso.get(v))
          .find(Boolean);
      if (!achado) return { ...citacao, status: "nao_verificada" };
      if (!digitoVerificadorCnjValido(citacao.valor)) {
        return { ...citacao, status: "mal_formada" };
      }
      return {
        ...citacao,
        status: "verificada",
        detalhe: {
          tribunal: achado.tribunal.toUpperCase(),
          numeroProcesso: achado.numero_processo,
          classe: achado.classe ?? undefined,
          relator: achado.relator ?? undefined,
          orgaoJulgador: achado.orgao_julgador ?? undefined,
          dataJulgamento: achado.data_julgamento,
          tese: achado.tese,
          tema: achado.tema,
        },
      };
    }

    if (citacao.tipo === "tema") {
      const achado = porTema.get(Number.parseInt(citacao.valor, 10));
      if (!achado) return { ...citacao, status: "nao_verificada" };
      return {
        ...citacao,
        status: "verificada",
        detalhe: {
          tribunal: achado.tribunal.toUpperCase(),
          numeroProcesso: achado.numero_processo,
          classe: achado.classe ?? undefined,
          relator: achado.relator ?? undefined,
          orgaoJulgador: achado.orgao_julgador ?? undefined,
          dataJulgamento: achado.data_julgamento,
          tese: achado.tese,
          tema: achado.tema,
        },
      };
    }

    // numero_stj e sumula: a base atual indexa por numero_processo (CNJ) —
    // esses formatos ficam explicitamente NÃO_VERIFICADOS até que haja
    // correspondência; nunca fingir verificação.
    return { ...citacao, status: "nao_verificada" };
  });
}
