/**
 * PRESCRIÇÃO/DECADÊNCIA — motor puro (sem I/O), Fase 16.
 *
 * Tabela dos prazos mais cobrados no dia a dia (fonte citada por item).
 * O cálculo é simples de propósito: data do termo inicial + prazo = data
 * final. INTERRUPÇÃO/SUSPENSÃO (arts. 199+ CC) não são simuladas — ficam
 * como premissa explícita, porque dependem de fatos do caso.
 */

export type TipoPrescricao =
  | "cc_geral_10_anos"
  | "reparacao_civil_3_anos"
  | "enriquecimento_sem_causa_2_anos"
  | "alugueis_3_anos"
  | "cdc_fato_produto_5_anos"
  | "cdc_vicio_duravel_90_dias"
  | "cdc_vicio_nao_duravel_30_dias"
  | "seguro_1_ano"
  | "tributaria_5_anos"
  | "trabalhista_2_anos_pos_contrato";

type DefinicaoPrescricao = {
  rotulo: string;
  anos?: number;
  dias?: number;
  fundamento: string;
  observacao: string;
};

const TABELA: Record<TipoPrescricao, DefinicaoPrescricao> = {
  cc_geral_10_anos: {
    rotulo: "Prescrição geral",
    anos: 10,
    fundamento: "Código Civil, art. 205",
    observacao: "Regra residual quando não houver prazo especial aplicável.",
  },
  reparacao_civil_3_anos: {
    rotulo: "Reparação civil (ato ilícito / acidente)",
    anos: 3,
    fundamento: "Código Civil, art. 206 §3º V",
    observacao: "Termo inicial: dia em que a vítima teve conhecimento do dano e da autoria.",
  },
  enriquecimento_sem_causa_2_anos: {
    rotulo: "Enriquecimento sem causa / pagamento indevido",
    anos: 2,
    fundamento: "Código Civil, art. 206 §3º IV",
    observacao: "Conta a partir do pagamento/enriquecimento.",
  },
  alugueis_3_anos: {
    rotulo: "Aluguéis de prédio urbano ou rural",
    anos: 3,
    fundamento: "Código Civil, art. 206 §3º I",
    observacao: "Contados da data em que cada aluguel venceu.",
  },
  cdc_fato_produto_5_anos: {
    rotulo: "CDC — fato do produto/serviço (acidente de consumo)",
    anos: 5,
    fundamento: "CDC, art. 27",
    observacao: "Somente para DANOS causados; vícios têm prazo próprio (art. 26).",
  },
  cdc_vicio_duravel_90_dias: {
    rotulo: "CDC — vícios aparentes, bem durável",
    dias: 90,
    fundamento: "CDC, art. 26 I",
    observacao: "Decadência — conta da entrega visível do vício; reclamação obsta a decadência até resposta negativa.",
  },
  cdc_vicio_nao_duravel_30_dias: {
    rotulo: "CDC — vícios aparentes, bem não durável",
    dias: 30,
    fundamento: "CDC, art. 26 II",
    observacao: "Decadência — idem regra de obstrução por reclamação formal.",
  },
  seguro_1_ano: {
    rotulo: "Seguro (sub-rogação / segurado × seguradora)",
    anos: 1,
    fundamento: "Código Civil, art. 206 §1º II",
    observacao: "Para o SEGURADO contra a seguradora. Sub-rogação da seguradora segue prazo comum de 1 ano também (art. 786).",
  },
  tributaria_5_anos: {
    rotulo: "Crédito tributário (prescrição da execução fiscal)",
    anos: 5,
    fundamento: "CTN, art. 174 + LEF art. 40",
    observacao: "Termo inicial: constituição definitiva do lançamento (ou decisão administrativa de impugnação).",
  },
  trabalhista_2_anos_pos_contrato: {
    rotulo: "Trabalhista — prescrição bienal",
    anos: 2,
    fundamento: "CF, art. 7º XXIX",
    observacao: "2 anos após extinção do contrato, alcançando parcelas dos 5 anos anteriores (prescrição total de 7 anos por fato).",
  },
};

export const PRAZOS_DISPONIVEIS = Object.entries(TABELA).map(([id, def]) => ({
  id: id as TipoPrescricao,
  rotulo: def.rotulo,
}));

export type ResultadoPrescricao = {
  tipo: TipoPrescricao;
  rotulo: string;
  termoInicial: string;
  dataFinal: string;
  diasRestantes: number;
  status: "prescrito" | "proximo" | "em_aberto";
  fundamento: string;
  premissas: string[];
};

function adicionar(isoData: string, anos: number, dias: number): string {
  const d = new Date(`${isoData}T12:00:00Z`);
  if (anos !== 0) d.setUTCFullYear(d.getUTCFullYear() + anos);
  if (dias !== 0) d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Calcula o termo final e o status frente à data de referência.
 * `proximo` = faltam menos de 180 dias (alerta preventivo).
 */
export function calcularPrescricao(
  tipo: TipoPrescricao,
  termoInicial: string,
  hoje: string,
): ResultadoPrescricao {
  const definicao = TABELA[tipo];
  if (!definicao) throw new Error("Tipo de prescrição desconhecido.");

  const dataFinal = adicionar(termoInicial, definicao.anos ?? 0, definicao.dias ?? 0);
  const msRestante = new Date(`${dataFinal}T12:00:00Z`).getTime() - new Date(`${hoje}T12:00:00Z`).getTime();
  const diasRestantes = Math.ceil(msRestante / 86_400_000);

  return {
    tipo,
    rotulo: definicao.rotulo,
    termoInicial,
    dataFinal,
    diasRestantes,
    status: diasRestantes <= 0 ? "prescrito" : diasRestantes <= 180 ? "proximo" : "em_aberto",
    fundamento: definicao.fundamento,
    premissas: [
      `Termo inicial informado pelo usuário (${termoInicial.split("-").reverse().join("/")}) — a definição correta dele costuma ser o ponto disputado na tese.`,
      "Não considera interrupção/suspensão (CC arts. 199-204), renúncia nem causas especiais do caso concreto.",
      definicao.observacao,
      `Fundamento: ${definicao.fundamento}.`,
    ],
  };
}
