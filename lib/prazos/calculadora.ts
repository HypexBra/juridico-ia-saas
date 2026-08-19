/**
 * Calculadora de prazo processual "orientada a dado" (feriados_forenses +
 * parte_contraria_tipo, migration 0010) — complementar a `lib/prazos/calculo.ts`
 * (que já cobre feriados nacionais/recesso forense hardcoded, calculados em
 * TS puro, sem depender do banco).
 *
 * Diferença de escopo deliberada: esta função NÃO calcula feriados sozinha —
 * ela recebe a lista de `feriados_forenses` (nacional + estadual) já
 * carregada do Supabase como parâmetro, para permanecer pura e 100%
 * testável sem I/O (quem chama busca no banco antes, ver
 * `lib/prazos/feriados.ts`). Isso também é o que permite tratar feriados
 * ESTADUAIS por UF — algo que `calculo.ts` não faz, porque UF é dado de
 * escritório/processo, não uma regra fixa de calendário nacional.
 *
 * Regras aplicadas:
 *  - Art. 219, CPC: prazo processual conta em dias ÚTEIS (pula fim de
 *    semana e feriado).
 *  - Art. 224, CPC: o dia da intimação é EXCLUÍDO da contagem; o prazo
 *    começa a correr no primeiro dia útil seguinte.
 *  - Art. 180 (Ministério Público), 183 (Fazenda Pública) e 186 (Defensoria
 *    Pública), CPC: prazo em DOBRO quando a parte contrária é qualquer uma
 *    dessas — a causa da dobra é `parte_contraria_tipo`, não uma escolha
 *    manual solta.
 *  - Feriado NACIONAL sempre pula a contagem, independente de UF. Feriado
 *    ESTADUAL só pula se a `uf` do prazo bater com a `uf` do feriado —
 *    feriado forense de um TJ não afeta processo de outro estado.
 *
 * Limitação conhecida (não é bug, é escopo do dado hoje): `feriados_forenses`
 * está carregada só com feriados nacionais FIXOS de 2026 (ver seed da
 * migration 0010) — feriados móveis (Carnaval, Sexta-feira Santa, Corpus
 * Christi) e feriados forenses estaduais dependem de um job anual popular
 * essa tabela (documentado no comentário da própria migration). Enquanto
 * esse job não existir, esta função simplesmente não vai pular datas que
 * não estão na lista recebida — ela não recalcula Páscoa sozinha (isso é
 * responsabilidade de `calculo.ts`, que já faz esse cálculo para o fluxo
 * hardcoded, ou do futuro job de seed).
 */

import { adicionarDias, ehFimDeSemana, formatarDataISO, paraDataUtc } from "./calculo";
import type { ParteContrariaTipo } from "@/lib/types";

export type { ParteContrariaTipo };

export type AbrangenciaFeriado = "nacional" | "estadual";

export type FeriadoForense = {
  data: string | Date;
  abrangencia: AbrangenciaFeriado;
  uf: string | null;
  descricao: string;
};

export type ParametrosCalculadoraPrazo = {
  /** Data em que a intimação foi disponibilizada/publicada. */
  dataIntimacao: string | Date;
  /** Prazo em dias ÚTEIS antes de qualquer dobra (ex: 15 para contestação padrão). */
  diasUteis: number;
  /** UF da comarca/tribunal do processo (`prazos.uf`); null se desconhecida. */
  uf: string | null;
  /** Causa da dobra do CPC (`prazos.parte_contraria_tipo`). */
  parteContrariaTipo: ParteContrariaTipo;
  /** Feriados já carregados do banco (`feriados_forenses`), nacional + estadual misturados. */
  feriados: FeriadoForense[];
};

export type FeriadoPuladoResultado = {
  dataISO: string;
  descricao: string;
  abrangencia: AbrangenciaFeriado;
};

export type ResultadoCalculadoraPrazo = {
  dataFinal: Date;
  dataFinalISO: string;
  dobrou: boolean;
  diasUteisOriginal: number;
  diasUteisAplicados: number;
  feriadosPulados: FeriadoPuladoResultado[];
  explicacao: string;
};

const MOTIVO_DOBRA: Record<Exclude<ParteContrariaTipo, "particular">, string> = {
  fazenda_publica: "parte contrária é Fazenda Pública (art. 183, CPC — prazo em dobro)",
  ministerio_publico: "parte contrária é Ministério Público (art. 180, CPC — prazo em dobro)",
  defensoria_publica: "parte contrária é Defensoria Pública (art. 186, CPC — prazo em dobro)",
};

/**
 * Calcula a data final do prazo processual, aplicando dobra do CPC (se a
 * parte contrária exigir) e pulando fins de semana + feriados forenses
 * relevantes (nacional sempre; estadual só se `uf` bater com o feriado).
 *
 * Função pura: mesma entrada sempre produz a mesma saída, sem acessar
 * relógio do sistema nem banco de dados.
 */
export function calcularPrazoComFeriados({
  dataIntimacao,
  diasUteis,
  uf,
  parteContrariaTipo,
  feriados,
}: ParametrosCalculadoraPrazo): ResultadoCalculadoraPrazo {
  if (diasUteis <= 0) throw new Error("diasUteis deve ser maior que zero.");

  const dobra = parteContrariaTipo !== "particular";
  const diasUteisAplicados = dobra ? diasUteis * 2 : diasUteis;

  const ufNormalizada = uf ? uf.trim().toUpperCase() : null;

  // Feriado nacional vale para qualquer UF; estadual só se casar com a UF
  // informada. Sem UF informada, feriado estadual nunca pula a contagem —
  // não há como saber se é relevante.
  const relevantes = feriados.filter((feriado) => {
    if (feriado.abrangencia === "nacional") return true;
    return ufNormalizada !== null && feriado.uf === ufNormalizada;
  });

  // Deduplica por data (duas linhas de feriado na mesma data, ex: erro de
  // seed ou nacional+estadual coincidindo) — só precisa pular uma vez.
  const porData = new Map<string, FeriadoForense>();
  for (const feriado of relevantes) {
    const iso = formatarDataISO(paraDataUtc(feriado.data));
    if (!porData.has(iso)) porData.set(iso, feriado);
  }

  let cursor = paraDataUtc(dataIntimacao);
  let contados = 0;
  const pulados: FeriadoPuladoResultado[] = [];

  while (contados < diasUteisAplicados) {
    cursor = adicionarDias(cursor, 1);
    if (ehFimDeSemana(cursor)) continue;

    const iso = formatarDataISO(cursor);
    const feriado = porData.get(iso);
    if (feriado) {
      pulados.push({ dataISO: iso, descricao: feriado.descricao, abrangencia: feriado.abrangencia });
      continue;
    }

    contados++;
  }

  const explicacaoDobra = dobra
    ? `Prazo dobrado de ${diasUteis} para ${diasUteisAplicados} dias úteis: ${
        MOTIVO_DOBRA[parteContrariaTipo as Exclude<ParteContrariaTipo, "particular">]
      }.`
    : `Prazo de ${diasUteis} dias úteis, sem dobra (parte contrária particular).`;

  const explicacaoFeriados =
    pulados.length > 0
      ? ` ${pulados.length} feriado(s) forense(s) pulado(s) na contagem: ${pulados
          .map((f) => `${f.dataISO} (${f.descricao})`)
          .join(", ")}.`
      : " Nenhum feriado forense no intervalo considerado.";

  return {
    dataFinal: cursor,
    dataFinalISO: formatarDataISO(cursor),
    dobrou: dobra,
    diasUteisOriginal: diasUteis,
    diasUteisAplicados,
    feriadosPulados: pulados,
    explicacao: explicacaoDobra + explicacaoFeriados,
  };
}
