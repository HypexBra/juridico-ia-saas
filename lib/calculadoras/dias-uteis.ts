/**
 * DIAS ÚTEIS E PRAZOS PROCESSUAIS — motor puro (sem I/O), Fase 16.
 *
 * Regras aplicadas (documentadas no resultado como premissas):
 *   - Feriados NACIONAIS fixos + móveis (Páscoa pelo algoritmo de Meeus/
 *     Jones/Butcher — carnaval = -47 dias, Sexta-Feira Santa = -2,
 *     Corpus Christi = +60).
 *   - Recesso forense (CPC, art. 220): de 20/dez a 20/jan não há práticas
 *     forenses — opcional na contagem (flag).
 *   - Contagem processual civil (CPC, arts. 219 e 224): exclui o dia do
 *     começo e INCLUI o do vencimento; prazos em DIAS são contados só em
 *     dias úteis; início sempre no primeiro dia útil seguinte à publicação.
 *   - Prazo em DOBRO (arts. 183/186): multiplica o total após a contagem.
 * Prazos em MESES/ANOS seguem contagem contínua (art. 132 CC) — não aplicam
 * regra de dias úteis (premissa explícita no resultado).
 */

export type Feriado = { data: string; nome: string };

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function iso(ano: number, mes: number, dia: number): string {
  return `${ano}-${pad2(mes)}-${pad2(dia)}`;
}

/** Algoritmo de Meeus/Jones/Butcher — Páscoa gregoriana. */
export function pascoa(ano: number): { mes: number; dia: number } {
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
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return { mes, dia };
}

function adicionarDias(isoData: string, dias: number): string {
  const d = new Date(`${isoData}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Feriados nacionais brasileiros de um ano (fixos + móveis). */
export function feriadosNacionais(ano: number): Feriado[] {
  const p = pascoa(ano);
  const dataPascoa = iso(ano, p.mes, p.dia);
  return [
    { data: iso(ano, 1, 1), nome: "Confraternização Universal" },
    { data: adicionarDias(dataPascoa, -48), nome: "Segunda-feira de Carnaval (ponto facultativo nacional)" },
    { data: adicionarDias(dataPascoa, -47), nome: "Terça-feira de Carnaval" },
    { data: adicionarDias(dataPascoa, -2), nome: "Sexta-feira da Paixão" },
    { data: iso(ano, 4, 21), nome: "Tiradentes" },
    { data: iso(ano, 5, 1), nome: "Dia do Trabalho" },
    { data: adicionarDias(dataPascoa, 60), nome: "Corpus Christi" },
    { data: iso(ano, 9, 7), nome: "Independência" },
    { data: iso(ano, 10, 12), nome: "Nossa Senhora Aparecida" },
    { data: iso(ano, 11, 2), nome: "Finados" },
    { data: iso(ano, 11, 15), nome: "Proclamação da República" },
    { data: iso(ano, 11, 20), nome: "Consciência Negra (Lei 14.759/2023)" },
    { data: iso(ano, 12, 25), nome: "Natal" },
  ];
}

const RECESSO_INICIO = { mes: 12, dia: 20 };
const RECESSO_FIM = { mes: 1, dia: 20 };

function emRecesso(isoData: string): boolean {
  const [, mesStr, diaStr] = isoData.split("-");
  const mes = Number.parseInt(mesStr!, 10);
  const dia = Number.parseInt(diaStr!, 10);
  if (mes === 12 && dia >= RECESSO_INICIO.dia) return true;
  if (mes === 1 && dia <= RECESSO_FIM.dia) return true;
  return false;
}

function ehDiaUtil(
  isoData: string,
  feriadosSet: Set<string>,
  considerarRecesso: boolean,
): boolean {
  const diaSemana = new Date(`${isoData}T12:00:00Z`).getUTCDay();
  if (diaSemana === 0 || diaSemana === 6) return false;
  if (feriadosSet.has(isoData)) return false;
  if (considerarRecesso && emRecesso(isoData)) return false;
  return true;
}

export type ParametrosPrazoProcessual = {
  /** Data da publicação/intimação (YYYY-MM-DD). */
  dataPublicacao: string;
  /** Prazo em dias úteis (CPC) — ignorado quando unidade é mes/ano. */
  dias?: number | null;
  meses?: number | null;
  anos?: number | null;
  /** Prazo em dobro (CPC arts. 183/186 — Fazenda, MP, Defensoria, litisconsortes). */
  emDobro?: boolean;
  /** Considerar recesso forense (art. 220) na contagem de dias úteis. */
  considerarRecesso?: boolean;
};

export type ResultadoPrazoProcessual = {
  inicioContagem: string;
  vencimento: string;
  diasUteisEfetivos: number | null;
  feriadosNoPeriodo: Feriado[];
  premissas: string[];
};

/**
 * Calcula o vencimento de um prazo processual. Para prazos em DIAS:
 * início no primeiro dia útil APÓS a publicação, exclusivo o dia do começo,
 * contagem só em dias úteis, vencimento prorrogado para o próximo útil se
 * cair em feriado/fim de semana (art. 224 §1º).
 */
export function calcularPrazoProcessual(params: ParametrosPrazoProcessual): ResultadoPrazoProcessual {
  const premissas: string[] = [];
  const anos = [new Date(`${params.dataPublicacao}T12:00:00Z`).getUTCFullYear(), new Date(`${params.dataPublicacao}T12:00:00Z`).getUTCFullYear() + 1];
  const feriados = anos.flatMap((ano) => feriadosNacionais(ano));
  const feriadosSet = new Set(feriados.map((f) => f.data));
  const considerarRecesso = params.considerarRecesso ?? false;

  // Início: primeiro dia útil estritamente posterior à publicação (art. 224 §2º/§3º).
  let cursor = params.dataPublicacao;
  do {
    cursor = adicionarDias(cursor, 1);
  } while (!ehDiaUtil(cursor, feriadosSet, considerarRecesso));
  const inicioContagem = cursor;

  if (params.dias != null && params.dias > 0) {
    let diasContados = 0;
    const feriadosNoPeriodo: Feriado[] = [];
    let vencimento = inicioContagem;
    while (diasContados < params.dias) {
      vencimento = adicionarDias(vencimento, 1);
      if (ehDiaUtil(vencimento, feriadosSet, considerarRecesso)) {
        diasContados += 1;
      } else if (feriadosSet.has(vencimento)) {
        const feriado = feriados.find((f) => f.data === vencimento);
        if (feriado) feriadosNoPeriodo.push(feriado);
      }
    }
    // Prorrogação: vencimento em não-dia-útil desliza pro próximo útil (art. 224 §1º).
    while (!ehDiaUtil(vencimento, feriadosSet, considerarRecesso)) {
      vencimento = adicionarDias(vencimento, 1);
    }

    let total = diasContados;
    if (params.emDobro) {
      // Em dobro: recalcula com o dobro dos dias úteis.
      const alvo = total * 2;
      let extra = vencimento;
      while (total < alvo) {
        extra = adicionarDias(extra, 1);
        if (ehDiaUtil(extra, feriadosSet, considerarRecesso)) total += 1;
      }
      while (!ehDiaUtil(extra, feriadosSet, considerarRecesso)) extra = adicionarDias(extra, 1);
      vencimento = extra;
      premissas.push("Prazo em DOBRO aplicado (CPC, arts. 183/186).");
    }

    premissas.push("Contagem em dias úteis (CPC, art. 219), excluindo o dia do começo (art. 224).");
    if (considerarRecesso) premissas.push("Recesso forense de 20/dez a 20/jan considerado (CPC, art. 220).");

    return {
      inicioContagem,
      vencimento,
      diasUteisEfetivos: total,
      feriadosNoPeriodo,
      premissas,
    };
  }

  // Meses/anos: contagem contínua (art. 132 CC) — vence no mesmo dia do mês,
  // deslocando para o último dia do mês quando inexistente.
  const base = new Date(`${inicioContagem}T12:00:00Z`);
  let vencimento: string;
  if (params.meses != null && params.meses > 0) {
    const alvoMes = base.getUTCMonth() + params.meses;
    const dataAlvo = new Date(Date.UTC(base.getUTCFullYear(), alvoMes, 1, 12));
    const ultimoDia = new Date(Date.UTC(dataAlvo.getUTCFullYear(), dataAlvo.getUTCMonth() + 1, 0)).getUTCDate();
    dataAlvo.setUTCDate(Math.min(base.getUTCDate(), ultimoDia));
    vencimento = dataAlvo.toISOString().slice(0, 10);
    premissas.push("Prazo em meses: contagem contínua, vence no mesmo dia do mês (CC, art. 132).");
  } else if (params.anos != null && params.anos > 0) {
    dataAno(base, params.anos);
    vencimento = base.toISOString().slice(0, 10);
    premissas.push("Prazo em anos: contagem contínua (CC, art. 132).");
  } else {
    throw new Error("Informe o prazo em dias, meses ou anos.");
  }

  function dataAno(d: Date, anosSomar: number) {
    d.setUTCFullYear(d.getUTCFullYear() + anosSomar);
  }

  while (!ehDiaUtil(vencimento, feriadosSet, false)) {
    vencimento = adicionarDias(vencimento, 1);
    premissas.push("Vencimento em fim de semana/feriado prorrogado para o próximo dia útil (art. 224 §1º).");
  }

  return { inicioContagem, vencimento, diasUteisEfetivos: null, feriadosNoPeriodo: [], premissas };
}

/** Conta dias úteis entre duas datas (útil p/ prescrição em dias corridos vs úteis). */
export function contarDiasUteis(inicio: string, fim: string, considerarRecesso = false): number {
  const anoInicio = Number.parseInt(inicio.slice(0, 4), 10);
  const anoFim = Number.parseInt(fim.slice(0, 4), 10);
  const feriadosSet = new Set<string>();
  for (let ano = anoInicio; ano <= anoFim; ano++) {
    for (const f of feriadosNacionais(ano)) feriadosSet.add(f.data);
  }
  let contador = 0;
  let cursor = inicio;
  while (cursor < fim) {
    cursor = adicionarDias(cursor, 1);
    if (ehDiaUtil(cursor, feriadosSet, considerarRecesso)) contador += 1;
  }
  return contador;
}
