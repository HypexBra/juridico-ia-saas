/**
 * Mapeamento puro dos dados já buscados pela camada de I/O (ficha, cliente
 * relacionado, prazo mais recente com processo, contrato de honorário mais
 * recente) para o shape `DadosMailMerge` que o motor de mail-merge
 * (`lib/peticoes/mail-merge.ts`) consome. Função pura e sem I/O — isolada só
 * para poder ser testada sem mockar Supabase; a busca em si vive em
 * `lib/peticoes/gerar-documento-ficha.ts`.
 */
import { formatarDataHojeMailMerge, formatarValorCausaMailMerge, type DadosMailMerge } from "./mail-merge";

export type EntradaMontagemDadosFicha = {
  /** `fichas_caso.nome_cliente` — preenchido direto na triagem. */
  nomeClienteFicha: string | null;
  /**
   * `clientes.nome` via `fichas_caso.cliente_id`, usado só como fallback
   * quando `nomeClienteFicha` está ausente (contrato documentado na
   * migration 0010).
   */
  nomeClientePorRelacao: string | null;
  /** `fichas_caso.area_direito`. */
  areaDireito: string | null;
  /** `prazos.numero_processo_cnj` do prazo mais recente com processo vinculado à ficha. */
  numeroProcessoCnj: string | null;
  /** `contratos_honorario.valor_total` do contrato mais recente vinculado à ficha. */
  valorCausaTotal: number | null;
  /** Data usada para `{{data_hoje}}`; default `new Date()` (injetável para teste determinístico). */
  dataReferencia?: Date;
};

export function montarDadosMailMergeDaFicha(entrada: EntradaMontagemDadosFicha): DadosMailMerge {
  return {
    nome_cliente: entrada.nomeClienteFicha ?? entrada.nomeClientePorRelacao,
    numero_processo: entrada.numeroProcessoCnj,
    area_direito: entrada.areaDireito,
    valor_causa: formatarValorCausaMailMerge(entrada.valorCausaTotal),
    data_hoje: formatarDataHojeMailMerge(entrada.dataReferencia),
  };
}
