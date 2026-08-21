/**
 * Mapeamento puro dos dados já buscados pela camada de I/O (ficha, cliente
 * relacionado, TODOS os prazos/contratos/parcelas vinculados — ao contrário
 * do mail-merge simples em `lib/peticoes/montar-dados-mail-merge.ts`, que só
 * usa o registro mais recente de cada um) para o `ContextoMailMergeCondicional`
 * que o motor (`lib/mailmerge-condicional/motor.ts`) consome. Função pura e
 * sem I/O — isolada só para poder ser testada sem mockar Supabase; a busca
 * em si vive em `app/app/fichas/[id]/mail-merge-condicional-actions.ts`.
 */
import { formatarDataHojeMailMerge, formatarValorCausaMailMerge } from "@/lib/peticoes/mail-merge";
import type { ContextoMailMergeCondicional, RegistroTemplate } from "./motor";

export type PrazoParaTemplate = {
  titulo: string;
  descricao: string | null;
  data_prazo: string;
  processo: string | null;
  concluido: boolean;
};

export type ContratoParaTemplate = {
  tipo: string;
  valor_total: number | null;
  percentual_exito: number | null;
};

export type ParcelaParaTemplate = {
  numero_parcela: number;
  valor: number;
  vencimento: string;
  status: "pendente" | "pago" | "atrasado";
};

export type EntradaMontagemDadosCondicionais = {
  /** `fichas_caso.nome_cliente` — preenchido direto na triagem. */
  nomeClienteFicha: string | null;
  /** `clientes.nome` via `fichas_caso.cliente_id`, fallback quando `nomeClienteFicha` está ausente. */
  nomeClientePorRelacao: string | null;
  /** `fichas_caso.area_direito`. */
  areaDireito: string | null;
  /** TODOS os prazos vinculados à ficha (não só o mais recente). */
  prazos: PrazoParaTemplate[];
  /** TODOS os contratos de honorário vinculados à ficha. */
  contratos: ContratoParaTemplate[];
  /** TODAS as parcelas de honorário de todos os contratos da ficha. */
  parcelas: ParcelaParaTemplate[];
  /** Data usada para `{{data_hoje}}`; default `new Date()` (injetável para teste determinístico). */
  dataReferencia?: Date;
};

/** `numero_processo` da ficha: pega do primeiro prazo com CNJ preenchido, mesmo critério do mail-merge simples. */
function extrairNumeroProcesso(prazos: PrazoParaTemplate[]): string | null {
  const comProcesso = prazos.find((p) => Boolean(p.processo));
  return comProcesso?.processo ?? null;
}

/** Soma o valor de todos os contratos como aproximação de "valor da causa" quando há mais de um. */
function extrairValorCausaTotal(contratos: ContratoParaTemplate[]): number | null {
  const valores = contratos.map((c) => c.valor_total).filter((v): v is number => v !== null);
  if (valores.length === 0) return null;
  return valores.reduce((soma, v) => soma + v, 0);
}

function mapearParcela(parcela: ParcelaParaTemplate): RegistroTemplate {
  const hoje = new Date();
  const vencimento = new Date(`${parcela.vencimento}T00:00:00`);
  const diasAtraso =
    parcela.status !== "pago" && !Number.isNaN(vencimento.getTime())
      ? Math.max(0, Math.floor((hoje.getTime() - vencimento.getTime()) / 86_400_000))
      : 0;

  return {
    numero_parcela: parcela.numero_parcela,
    valor: formatarValorCausaMailMerge(parcela.valor),
    valor_numero: parcela.valor,
    vencimento: new Date(`${parcela.vencimento}T00:00:00`).toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    }),
    status: parcela.status,
    // `atrasada` é derivado (status "atrasado" OU vencida e ainda pendente) — permite
    // `{{#se atrasada}}` sem depender do usuário acertar o status manualmente no banco.
    atrasada: parcela.status === "atrasado" || (parcela.status === "pendente" && diasAtraso > 0),
    dias_atraso: diasAtraso,
  };
}

function mapearPrazo(prazo: PrazoParaTemplate): RegistroTemplate {
  return {
    titulo: prazo.titulo,
    descricao: prazo.descricao,
    data_prazo: new Date(`${prazo.data_prazo}T00:00:00`).toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    }),
    processo: prazo.processo,
    concluido: prazo.concluido,
  };
}

function mapearContrato(contrato: ContratoParaTemplate): RegistroTemplate {
  return {
    tipo: contrato.tipo,
    valor_total: formatarValorCausaMailMerge(contrato.valor_total),
    valor_total_numero: contrato.valor_total,
    percentual_exito: contrato.percentual_exito,
  };
}

export function montarDadosCondicionaisDaFicha(
  entrada: EntradaMontagemDadosCondicionais,
): ContextoMailMergeCondicional {
  return {
    nome_cliente: entrada.nomeClienteFicha ?? entrada.nomeClientePorRelacao,
    numero_processo: extrairNumeroProcesso(entrada.prazos),
    area_direito: entrada.areaDireito,
    valor_causa: formatarValorCausaMailMerge(extrairValorCausaTotal(entrada.contratos)),
    data_hoje: formatarDataHojeMailMerge(entrada.dataReferencia),
    parcelas: entrada.parcelas.map(mapearParcela),
    prazos: entrada.prazos.map(mapearPrazo),
    contratos: entrada.contratos.map(mapearContrato),
  };
}
