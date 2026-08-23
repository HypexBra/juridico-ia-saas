/**
 * ORQUESTRADOR DE INTENÇÃO (Fase 18 — leve).
 *
 * O usuário não deveria precisar saber qual "agente" chamar: ele digita o
 * pedido em linguagem natural e este módulo aponta a ferramenta certa.
 * Heurística PURA pt-BR (keywords/regex sobre texto normalizado): zero I/O,
 * zero rede, zero custo, latência zero — determinística e testável.
 *
 * Deliberadamente CONSERVADORA: quando a confiança é "baixa" ou nada casa,
 * devolve sinal fraco/null para o chamador NÃO empurrar navegação errada
 * (o Command Center só exibe sugestões de confiança alta/média).
 */

export type RotaAgente =
  | "pesquisa_juridica"
  | "estrategia_caso"
  | "gerar_documento"
  | "auditoria_peca"
  | "advogado_contra"
  | "calculadora"
  | "prazos_radar"
  | "chat";

export type ConfiancaRota = "alta" | "media" | "baixa";

export interface SugestaoRota {
  rota: RotaAgente;
  confianca: ConfiancaRota;
  /** ≤60 chars, cita o termo detectado no texto do usuário. */
  motivoCurto: string;
}

/** Sinal forte: termo inequívoco da intenção (1 já autoriza sugestão média). */
/** Sinal fraco: sozinho só autoriza confiança "baixa". */
interface SinaisRota {
  rota: Exclude<RotaAgente, "chat">;
  fortes: RegExp[];
  fracos: RegExp[];
}

const PESO_FORTE = 10;
const PESO_FRACO = 1;

/**
 * Ordem importa apenas para desempate (mesmo score): rotas mais específicas
 * primeiro — ex. "atacar a tese" deve cair em advogado_contra mesmo contendo
 * o termo genérico de estratégia ("tese").
 */
const ROTAS: readonly SinaisRota[] = [
  {
    rota: "pesquisa_juridica",
    fortes: [
      /\bjurisprudencias?\b/,
      /\bstj\b/,
      /\bacordaos?\b/,
      /\bprecedentes?\b/,
      /\bfontes?\b/,
    ],
    fracos: [/\btribunal(is)?\b/, /\bsumulas?\b/, /\bentendimentos?\b/],
  },
  {
    rota: "gerar_documento",
    fortes: [
      /\bminutas?\b/,
      /\bpetic(ao|oes)\b/,
      /\bprocuracaos?\b/,
      /\bcontratos?\b/,
      /\bredigir\b/,
      /\brascunhos?\b/,
    ],
    fracos: [/\bdocumentos?\b/, /\belaborar\b/],
  },
  {
    rota: "auditoria_peca",
    fortes: [
      /\baudit(ar|or|oria|agem)\b/,
      // "revisar peça" / "revisão da peça" / "revisando a peça".
      /\brevis\w*[^.?!]{0,20}\bpecas?\b/,
      /\bconsistencias?\b/,
      /\bincoerencias?\b/,
    ],
    fracos: [/\brevis(ar|ando|ao)\b/, /\berros?\b/],
  },
  {
    rota: "advogado_contra",
    fortes: [
      /parte contraria/,
      /advogado (do )?contra/,
      /lado do contra/,
      /atacar (a |a minha |minha |a nossa |essa )?tese/,
      /contra[- ]?argument(o|ar)/,
      /\brefutar\b/,
      /\brebater\b/,
      /pontos? fraqu(os|as)/,
      // "argumentar contra a tese" / "tese ... contra": o advérbio inverte a
      // intenção — cada direção (tese→contra, contra→tese) vale um sinal
      // próprio, então a frase completa atinge confiança ALTA e desempata
      // contra estrategia_caso pela prioridade declarada em ROTAS.
      /\b(tese|argument\w*)[^.?!]{0,30}\bcontra\b/,
      /\bcontra\b[^.?!]{0,30}\b(tese|argument\w*)/,
    ],
    fracos: [/\bfraquezas?\b/, /\bvulnerabilidades?\b/],
  },
  {
    rota: "estrategia_caso",
    fortes: [
      /\bestrategias?\b/,
      /\btese(s)?\b/,
      /\bargument(ar|os|acao)\b/,
      /\bprobabilidade(s)?\b/,
    ],
    fracos: [/\bviabilidade\b/, /\bmerito\b/],
  },
  {
    rota: "calculadora",
    fortes: [
      /\bcalcul(ar|o|adora?)\b/,
      /\bjuros?\b/,
      /corre(c|cao)[a-z]* monetaria/,
      /atualiza(c|cao)[a-z]* monetaria/,
      /\bdias? uteis\b/,
      /\bhonorarios?\b/,
    ],
    fracos: [/\bmultas?\b/, /\bmontante\b/, /\bparcelas?\b/],
  },
  {
    rota: "prazos_radar",
    fortes: [
      /\bprazos?\b/,
      /vencendo\b/,
      /\bdiarios?\b/,
      /movimentac(ao|oes)\b/,
      /\bradar\b/,
    ],
    fracos: [/\bintimacoes?\b/, /\bpublicacoes?\b/, /\bandamento\b/],
  },
] as const;

const MOTIVOS_POR_ROTA: Record<Exclude<RotaAgente, "chat">, string> = {
  pesquisa_juridica: "busca de jurisprudência e fontes verificáveis",
  estrategia_caso: "análise estratégica e tese do caso",
  gerar_documento: "geração de minutas e documentos",
  auditoria_peca: "auditoria de consistência da peça",
  advogado_contra: "ataque adversarial à tese",
  calculadora: "cálculos de juros, prazos e honorários",
  prazos_radar: "radar de prazos e movimentações",
};

/** Lowercase + remove acentos (NFD) — "Acórdão" ≡ "acordao", "JÚROS" ≡ "juros". */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Monta motivo ≤60 chars SEMPRE citando o termo detectado (trunca o resto). */
function montarMotivo(termo: string, rota: Exclude<RotaAgente, "chat">): string {
  const prefixo = `"${termo}" · `;
  const limiteTemplate = 60 - prefixo.length;
  const template = MOTIVOS_POR_ROTA[rota];
  const corpo =
    template.length <= limiteTemplate ? template : `${template.slice(0, Math.max(limiteTemplate - 1, 0))}…`;
  return `${prefixo}${corpo}`;
}

interface MatchDetectado {
  termo: string;
  forte: boolean;
}

function coletarMatches(normalizado: string, sinais: SinaisRota): MatchDetectado[] {
  const encontrados: MatchDetectado[] = [];
  for (const padrao of sinais.fortes) {
    const match = padrao.exec(normalizado);
    if (match?.[0]) encontrados.push({ termo: match[0], forte: true });
  }
  for (const padrao of sinais.fracos) {
    const match = padrao.exec(normalizado);
    if (match?.[0]) encontrados.push({ termo: match[0], forte: false });
  }
  return encontrados;
}

/**
 * Classifica a intenção do pedido em linguagem natural pt-BR.
 * Confiança: "alta" (2+ sinais fortes), "media" (1 sinal forte),
 * "baixa" (apenas sinais fracos), null (nada reconhecível).
 */
export function classificarIntencao(texto: string): SugestaoRota | null {
  const normalizado = normalizar(texto).trim();
  if (!normalizado) return null;

  let melhor: { sinais: SinaisRota; matches: MatchDetectado[]; score: number } | null = null;

  for (const sinais of ROTAS) {
    const matches = coletarMatches(normalizado, sinais);
    if (matches.length === 0) continue;
    const score = matches.reduce((acc, m) => acc + (m.forte ? PESO_FORTE : PESO_FRACO), 0);
    if (!melhor || score > melhor.score) melhor = { sinais, matches, score };
  }

  if (!melhor) return null;

  const fortes = melhor.matches.filter((m) => m.forte);
  const confianca: ConfiancaRota = fortes.length >= 2 ? "alta" : fortes.length === 1 ? "media" : "baixa";
  const detectado = fortes[0] ?? melhor.matches[0];
  if (!detectado) return null;

  return {
    rota: melhor.sinais.rota,
    confianca,
    motivoCurto: montarMotivo(detectado.termo, melhor.sinais.rota),
  };
}

export interface DestinoRota {
  href: string;
  label: string;
  /** Dica extra exibida ao usuário (ex.: precisa escolher o caso antes). */
  nota?: string;
}

/** Mapa estático rota → destino real do app. `chat` não tem tela própria. */
export function rotaParaDestino(rota: RotaAgente): DestinoRota | null {
  switch (rota) {
    case "pesquisa_juridica":
      return { href: "/app/pesquisa", label: "Pesquisa Jurídica" };
    case "estrategia_caso":
      return { href: "/app/fichas", label: "Fichas / Casos", nota: "abra o caso" };
    case "gerar_documento":
      return { href: "/app/modelos", label: "Modelos de documentos" };
    case "auditoria_peca":
      return { href: "/app/auditor", label: "Auditar peça" };
    case "advogado_contra":
      return { href: "/app/advogado-contra", label: "Advogado do Contra" };
    case "calculadora":
      return { href: "/app/calculadoras", label: "Calculadoras" };
    case "prazos_radar":
      return { href: "/app/prazos", label: "Prazos" };
    case "chat":
      return null;
  }
}
