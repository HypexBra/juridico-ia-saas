/**
 * Motor de cálculo de prazo processual. Função pura (sem I/O, sem
 * dependência de banco/relógio do sistema além do parâmetro `hoje` opcional
 * usado só em testes) — toda a lógica de datas do produto passa por aqui.
 *
 * Regras aplicadas (Código de Processo Civil / Lei 5.010/1966):
 *  - Art. 219, CPC: prazos processuais só correm em dias ÚTEIS (exclui
 *    sábado, domingo e feriados).
 *  - Art. 224, CPC: o dia do começo do prazo (aqui, a data de intimação) é
 *    EXCLUÍDO da contagem; a contagem inicia no primeiro dia útil seguinte.
 *  - Art. 183 (Fazenda Pública) e art. 186 (Defensoria Pública), CPC: prazo
 *    em dobro para todas as manifestações processuais.
 *  - Art. 220, CPC + Lei 5.010/66 art. 62, I: suspensão dos prazos entre
 *    20 de dezembro e 20 de janeiro (recesso forense), ambos inclusive.
 *
 * Feriados nacionais forenses: lista fixa (fonte: calendário oficial de
 * feriados nacionais, Lei 10.607/2002 e Lei 6.802/1980, mais Lei
 * 14.759/2023 que tornou 20/nov feriado nacional) + feriados móveis
 * calculados a partir da Páscoa (Carnaval, Sexta-feira Santa e Corpus
 * Christi — tradicionalmente tratados como feriado forense na maioria dos
 * tribunais, embora Corpus Christi seja facultativo em alguns). Feriados
 * estaduais/municipais e suspensões de expediente específicas de cada
 * tribunal NÃO são cobertos aqui — ficaria acoplado a `tribunal`/UF e é
 * escopo futuro; documentado como limitação conhecida, não bug.
 */

/**
 * Exportado (além de usado internamente aqui) porque `lib/prazos/calculadora.ts`
 * reaproveita esta mesma checagem de fim de semana em vez de duplicá-la.
 */
export function ehFimDeSemana(data: Date): boolean {
  const dia = data.getUTCDay();
  return dia === 0 || dia === 6;
}

/** Domingo de Páscoa pelo algoritmo de Gauss (calendário gregoriano). */
function calcularPascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31); // 3 = março, 4 = abril
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia));
}

/** Exportado — reaproveitado por `lib/prazos/calculadora.ts` (mesmo motivo acima). */
export function adicionarDias(data: Date, dias: number): Date {
  const copia = new Date(data);
  copia.setUTCDate(copia.getUTCDate() + dias);
  return copia;
}

function mesmoDia(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
}

function feriadosMoveis(ano: number): Date[] {
  const pascoa = calcularPascoa(ano);
  return [
    adicionarDias(pascoa, -48), // segunda-feira de Carnaval
    adicionarDias(pascoa, -47), // terça-feira de Carnaval
    adicionarDias(pascoa, -2), // sexta-feira Santa
    adicionarDias(pascoa, 60), // Corpus Christi
  ];
}

function feriadosFixos(ano: number): Date[] {
  return [
    new Date(Date.UTC(ano, 0, 1)), // Confraternização Universal
    new Date(Date.UTC(ano, 3, 21)), // Tiradentes
    new Date(Date.UTC(ano, 4, 1)), // Dia do Trabalho
    new Date(Date.UTC(ano, 8, 7)), // Independência
    new Date(Date.UTC(ano, 9, 12)), // Nossa Senhora Aparecida
    new Date(Date.UTC(ano, 10, 2)), // Finados
    new Date(Date.UTC(ano, 10, 15)), // Proclamação da República
    new Date(Date.UTC(ano, 10, 20)), // Consciência Negra (Lei 14.759/2023)
    new Date(Date.UTC(ano, 11, 25)), // Natal
  ];
}

/** Feriado nacional forense (fixo ou móvel) na data informada. */
export function ehFeriadoForense(data: Date): boolean {
  const ano = data.getUTCFullYear();
  const feriados = [...feriadosFixos(ano), ...feriadosMoveis(ano)];
  return feriados.some((f) => mesmoDia(f, data));
}

/**
 * Recesso forense: 20/dez a 20/jan, ambos inclusive (Lei 5.010/66, art. 62,
 * I; CPC art. 220). Atravessa virada de ano, por isso checa os dois lados.
 */
export function ehRecessoForense(data: Date): boolean {
  const ano = data.getUTCFullYear();
  const inicioEsteAno = new Date(Date.UTC(ano, 11, 20)); // 20/dez deste ano
  const fimAnoQueVem = new Date(Date.UTC(ano + 1, 0, 20)); // 20/jan do ano seguinte
  const fimEsteAno = new Date(Date.UTC(ano, 0, 20)); // 20/jan deste ano
  const inicioAnoPassado = new Date(Date.UTC(ano - 1, 11, 20)); // 20/dez do ano anterior

  const dentroDaVirada = data >= inicioEsteAno && data <= fimAnoQueVem;
  const dentroDoInicioDoAno = data >= inicioAnoPassado && data <= fimEsteAno;
  return dentroDaVirada || dentroDoInicioDoAno;
}

/** Dia útil forense: não é fim de semana, feriado nacional forense, nem recesso. */
export function ehDiaUtilForense(data: Date): boolean {
  return !ehFimDeSemana(data) && !ehFeriadoForense(data) && !ehRecessoForense(data);
}

export type ParametrosCalculoPrazo = {
  /** Data em que a intimação foi disponibilizada/publicada (YYYY-MM-DD ou Date). */
  dataIntimacao: string | Date;
  /** Quantidade de dias ÚTEIS do prazo (ex: 15 para contestação padrão, CPC art. 335). */
  diasUteis: number;
  /** Fazenda Pública ou Defensoria Pública: dobra a contagem (art. 183/186, CPC). */
  prazoEmDobro?: boolean;
};

/** Exportado — reaproveitado por `lib/prazos/calculadora.ts` (mesmo motivo acima). */
export function paraDataUtc(valor: string | Date): Date {
  if (valor instanceof Date) {
    return new Date(Date.UTC(valor.getUTCFullYear(), valor.getUTCMonth(), valor.getUTCDate()));
  }
  const [ano, mes, dia] = valor.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

/**
 * Calcula a data final do prazo processual a partir da data de intimação.
 * Conta apenas dias úteis forenses; o dia da intimação nunca é contado (a
 * contagem começa no 1º dia útil seguinte, art. 224 CPC). Se `prazoEmDobro`,
 * a quantidade de dias úteis é dobrada antes da contagem.
 */
export function calcularPrazoProcessual({
  dataIntimacao,
  diasUteis,
  prazoEmDobro = false,
}: ParametrosCalculoPrazo): Date {
  if (diasUteis <= 0) throw new Error("diasUteis deve ser maior que zero.");

  const totalDias = prazoEmDobro ? diasUteis * 2 : diasUteis;
  let cursor = paraDataUtc(dataIntimacao);
  let contados = 0;

  while (contados < totalDias) {
    cursor = adicionarDias(cursor, 1);
    if (ehDiaUtilForense(cursor)) contados++;
  }

  return cursor;
}

/** Formata uma Date (UTC) como YYYY-MM-DD, formato usado nas colunas `date` do banco. */
export function formatarDataISO(data: Date): string {
  const ano = data.getUTCFullYear();
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(data.getUTCDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}
