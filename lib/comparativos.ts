/**
 * Dados dos comparativos institucionais (`/comparativo/*`). Todo fato sobre
 * concorrentes vem exclusivamente do que foi levantado na auditoria pública
 * do produto (data em `DATA_AUDITORIA`): nada é inferido ou inventado além
 * disso. Tom sóbrio e honesto: o objetivo é mostrar diferencial real
 * (auditoria de peça + advogado do contra + narrativa de caso único), não
 * atacar o concorrente.
 */

export const DATA_AUDITORIA = "1 de setembro de 2026";

export interface ComparativoLinha {
  readonly dimensao: string;
  readonly juridicoIa: string;
  readonly concorrente: string;
  /** Marca a linha como diferencial do Jurídico IA hoje (realce visual). */
  readonly diferencialJuridicoIa?: boolean;
}

export interface Comparativo {
  readonly slug: string;
  readonly nomeConcorrente: string;
  readonly kicker: string;
  readonly titulo: string;
  readonly descricao: string;
  readonly intro: string;
  readonly linhas: readonly ComparativoLinha[];
  readonly notaFinal: string;
}

const LINHAS_COMUNS_PRECO: ComparativoLinha = {
  dimensao: "Preço de entrada",
  juridicoIa: "R$ 0 (Free) · R$ 149/mês (Pro)",
  concorrente: "Sem plano gratuito confirmado",
};

export const COMPARATIVOS: readonly Comparativo[] = [
  {
    slug: "juridico-ia-vs-astrea",
    nomeConcorrente: "Astrea",
    kicker: "Comparativo",
    titulo: "Jurídico IA vs. Astrea",
    descricao:
      "Comparativo honesto entre Jurídico IA e Astrea, baseado em informação pública disponível. Sem números fabricados, sem ataque ao concorrente.",
    intro:
      "A Astrea é uma plataforma de gestão jurídica conhecida no mercado brasileiro. Este comparativo olha para o que está publicamente disponível em setembro de 2026 e destaca onde os dois produtos se posicionam de forma diferente: principalmente na forma como cada um organiza o trabalho do dia a dia do advogado.",
    linhas: [
      {
        dimensao: "Narrativa do produto",
        juridicoIa: "Um caso único, do começo ao fim (documentos, prazos, tarefas e cliente no mesmo lugar)",
        concorrente: "Conjunto de features apresentadas separadamente, com prints de dashboard",
        diferencialJuridicoIa: true,
      },
      {
        dimensao: "Chat de IA com contexto do caso",
        juridicoIa: "Sim, com o contexto completo do caso em cada conversa",
        concorrente: "Parcial",
        diferencialJuridicoIa: true,
      },
      {
        dimensao: "Auditoria automática de peça antes de assinar",
        juridicoIa: "Sim, roda antes de qualquer peça ser assinada",
        concorrente: "Não identificada",
        diferencialJuridicoIa: true,
      },
      {
        dimensao: "Simulação \"advogado do contra\"",
        juridicoIa: "Sim, único identificado no nicho até esta auditoria",
        concorrente: "Não identificada",
        diferencialJuridicoIa: true,
      },
      {
        dimensao: "Pesquisa jurisprudencial verificável",
        juridicoIa: "Hoje limitada ao STJ, com dados abertos oficiais",
        concorrente: "Cobertura limitada, sem verificação de fonte identificada",
      },
      {
        dimensao: "Monitoramento de prazos (DJEN)",
        juridicoIa: "Sim",
        concorrente: "Sim",
      },
      {
        dimensao: "Portal do cliente",
        juridicoIa: "Sim",
        concorrente: "Parcial",
      },
      {
        dimensao: "WhatsApp para o cliente final",
        juridicoIa: "Sim, nativo",
        concorrente: "Não identificado",
      },
      {
        dimensao: "Financeiro e honorários",
        juridicoIa: "Não é o foco atual do produto",
        concorrente: "Sim",
      },
      LINHAS_COMUNS_PRECO,
    ],
    notaFinal:
      "A Astrea é uma opção estabelecida para gestão financeira e operacional de escritórios. O Jurídico IA se diferencia por tratar cada processo como um caso único auditado de ponta a ponta: não por cobrir mais módulos de gestão.",
  },
  {
    slug: "juridico-ia-vs-advbox",
    nomeConcorrente: "ADVBOX",
    kicker: "Comparativo",
    titulo: "Jurídico IA vs. ADVBOX",
    descricao:
      "Comparativo honesto entre Jurídico IA e ADVBOX, baseado em informação pública disponível. Sem números fabricados, sem ataque ao concorrente.",
    intro:
      "A ADVBOX é um software de gestão jurídica com forte presença em CRM e financeiro para escritórios. Este comparativo olha para o que está publicamente disponível em setembro de 2026 e destaca onde os dois produtos se posicionam de forma diferente.",
    linhas: [
      {
        dimensao: "Narrativa do produto",
        juridicoIa: "Um caso único, do começo ao fim (documentos, prazos, tarefas e cliente no mesmo lugar)",
        concorrente: "Narrativa de produto mediana, com foco em módulos de gestão",
        diferencialJuridicoIa: true,
      },
      {
        dimensao: "Chat de IA com contexto do caso",
        juridicoIa: "Sim, com o contexto completo do caso em cada conversa",
        concorrente: "Parcial",
        diferencialJuridicoIa: true,
      },
      {
        dimensao: "Auditoria automática de peça antes de assinar",
        juridicoIa: "Sim, roda antes de qualquer peça ser assinada",
        concorrente: "Não identificada",
        diferencialJuridicoIa: true,
      },
      {
        dimensao: "Simulação \"advogado do contra\"",
        juridicoIa: "Sim, único identificado no nicho até esta auditoria",
        concorrente: "Não identificada",
        diferencialJuridicoIa: true,
      },
      {
        dimensao: "Pesquisa jurisprudencial verificável",
        juridicoIa: "Hoje limitada ao STJ, com dados abertos oficiais",
        concorrente: "Cobertura limitada, sem verificação de fonte identificada",
      },
      {
        dimensao: "Monitoramento de prazos (DJEN)",
        juridicoIa: "Sim",
        concorrente: "Sim",
      },
      {
        dimensao: "Portal do cliente",
        juridicoIa: "Sim",
        concorrente: "Parcial",
      },
      {
        dimensao: "WhatsApp para o cliente final",
        juridicoIa: "Sim, nativo",
        concorrente: "Parcial",
      },
      {
        dimensao: "Financeiro e honorários",
        juridicoIa: "Não é o foco atual do produto",
        concorrente: "Sim",
      },
      {
        dimensao: "CRM",
        juridicoIa: "Não é o foco atual do produto",
        concorrente: "Parcial",
      },
      LINHAS_COMUNS_PRECO,
    ],
    notaFinal:
      "A ADVBOX é uma opção conhecida por CRM e financeiro de escritórios. O Jurídico IA se diferencia por tratar cada processo como um caso único auditado de ponta a ponta: não por cobrir mais módulos de gestão comercial.",
  },
] as const;

export function obterComparativo(slug: string): Comparativo | undefined {
  return COMPARATIVOS.find((comparativo) => comparativo.slug === slug);
}
