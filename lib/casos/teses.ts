import type { EntradaHistoricoTeseCaso, StatusTeseCaso } from "@/lib/types";

export type NovaTeseCasoInput = {
  escritorioId: string;
  fichaCasoId: string;
  tese: string;
  fundamentacao: string | null;
};

export type NovaTeseCasoPayload = {
  escritorio_id: string;
  ficha_caso_id: string;
  tese: string;
  fundamentacao: string | null;
  status: StatusTeseCaso;
  historico: EntradaHistoricoTeseCaso[];
};

/**
 * Monta o payload de insert de uma nova linha em `teses_caso` (migration
 * 0025). Toda tese nasce com status `em_avaliacao` — a adoção/descarte é
 * sempre uma decisão explícita e posterior do advogado, nunca herdada da IA
 * que a gerou. O `historico` já nasce com a primeira entrada (criação),
 * mantendo o mesmo formato append-only usado em `montarAtualizacaoStatusTese`.
 */
export function montarNovaTeseCaso(input: NovaTeseCasoInput): NovaTeseCasoPayload {
  const tese = input.tese.trim();
  if (!tese) {
    throw new Error("A tese jurídica não pode ser vazia.");
  }

  const agora = new Date().toISOString();
  const entradaInicial: EntradaHistoricoTeseCaso = {
    em: agora,
    status_anterior: null,
    status_novo: "em_avaliacao",
    nota: "Tese registrada.",
  };

  return {
    escritorio_id: input.escritorioId,
    ficha_caso_id: input.fichaCasoId,
    tese,
    fundamentacao: input.fundamentacao?.trim() || null,
    status: "em_avaliacao",
    historico: [entradaInicial],
  };
}

export type DadosAnaliseIaParaTese = {
  areaDireito: string | null;
  estrategiaIa: string | null;
  questoesIa: string | null;
};

const TAMANHO_MAXIMO_TESE = 4000;

/**
 * A partir do texto que `gerarAnaliseIaAction` já extrai da resposta da IA
 * (seções `ESTRATEGIA`/`QUESTOES`), decide se há conteúdo suficiente para
 * registrar uma nova entrada em `teses_caso` e monta os campos `tese`
 * (a estratégia recomendada, prefixada pela área do direito quando
 * conhecida) e `fundamentacao` (as questões jurídicas levantadas). Retorna
 * `null` quando a IA não produziu estratégia nenhuma — nesse caso não há
 * tese a registrar, só o resumo/risco da ficha são atualizados.
 */
export function montarTeseCasoDaAnaliseIa(
  dados: DadosAnaliseIaParaTese,
): { tese: string; fundamentacao: string | null } | null {
  const estrategia = dados.estrategiaIa?.trim();
  if (!estrategia) return null;

  const prefixoArea = dados.areaDireito?.trim() ? `[${dados.areaDireito.trim()}] ` : "";
  const teseCompleta = `${prefixoArea}${estrategia}`;
  const tese =
    teseCompleta.length > TAMANHO_MAXIMO_TESE ? teseCompleta.slice(0, TAMANHO_MAXIMO_TESE) : teseCompleta;

  return {
    tese,
    fundamentacao: dados.questoesIa?.trim() || null,
  };
}

export type AtualizarStatusTeseInput = {
  statusAtual: StatusTeseCaso;
  historicoAtual: EntradaHistoricoTeseCaso[];
  novoStatus: StatusTeseCaso;
  nota?: string | null;
};

export type AtualizacaoStatusTesePayload = {
  status: StatusTeseCaso;
  historico: EntradaHistoricoTeseCaso[];
};

/**
 * Monta o payload de "adotar"/"descartar" (ou devolver para avaliação) uma
 * tese já existente. Nunca reescreve `tese`/`fundamentacao` — só o `status`
 * muda, e a mudança é sempre registrada como um novo item no `historico`
 * append-only (nunca substituindo entradas anteriores), preservando a trilha
 * completa de decisão do caso.
 */
export function montarAtualizacaoStatusTese(input: AtualizarStatusTeseInput): AtualizacaoStatusTesePayload {
  if (input.novoStatus === input.statusAtual) {
    throw new Error("A tese já está com este status.");
  }

  const entrada: EntradaHistoricoTeseCaso = {
    em: new Date().toISOString(),
    status_anterior: input.statusAtual,
    status_novo: input.novoStatus,
    nota: input.nota?.trim() || null,
  };

  return {
    status: input.novoStatus,
    historico: [...input.historicoAtual, entrada],
  };
}
