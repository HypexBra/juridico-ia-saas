/**
 * Mapeamento puro dos dados do "Caso Inteligente" (pessoas, linha do tempo,
 * teses, tarefas e a estratégia mais recente pronta do Estrategista Jurídico)
 * para um bloco extra de variáveis do mail-merge condicional. Mesmo padrão de
 * `montar-dados.ts`: função pura, sem I/O — a busca em si vive em
 * `app/app/fichas/[id]/mail-merge-condicional-actions.ts`, que mescla
 * `{...dadosExistentes, ...contextoDoCaso}` antes de chamar o motor.
 *
 * Convenções herdadas do motor (`motor.ts`) e do montar-dados:
 * - Dado ausente nunca quebra: string vazia / `null` vira "não informado"
 *   na interpolação e entra em `variaveisNaoResolvidas`.
 * - Coleção vazia → bloco `{{#cada ...}}` não renderiza nada.
 * - Datas são formatadas pt-BR (America/Sao_Paulo), como nas parcelas/prazos.
 * - `{{indice}}` (1-based) já é injetado automaticamente pelo motor em cada
 *   iteração; aqui ele também vem explícito no registro para o item ser
 *   autocontido em testes e no catálogo de variáveis.
 *
 * Campos validados contra o schema real:
 * - `pessoas_caso`     → migration 0023_caso_pessoas.sql
 * - `eventos_caso`     → migration 0024_caso_linha_tempo.sql
 * - `teses_caso`       → migration 0025_caso_teses.sql
 * - `tarefas_caso`     → migrations 0027_caso_tarefas.sql + 0043_tarefas_prioridade.sql
 * - `estrategias_caso` → migration 0041_estrategia_caso.sql (jsonb
 *   `resultado_estrategia` segue `ResultadoEstrategiaCaso` de
 *   `lib/estrategia-caso/tipos.ts`, ADR 0014 — estreitado defensivamente,
 *   porque jsonb gravado por IA pode vir malformado).
 */
import type { RegistroTemplate } from "./motor";

/** Campos usados de `pessoas_caso` (0023) — espelha só o que entra no template. */
export type PessoaCasoParaContexto = {
  /** Necessário só para `teses_caso` resolver tese referenciada; aqui é documental. */
  nome: string;
  /** 'parte' | 'adverso' | 'testemunha' | 'terceiro' (check da migration 0023). */
  tipo: string;
  documento: string | null;
  contato: string | null;
  papel_processual: string | null;
};

/** Campos usados de `eventos_caso` (0024, append-only). */
export type EventoCasoParaContexto = {
  tipo_evento: string;
  descricao: string;
  /** timestamptz ISO — formatado pt-BR no registro final. */
  data_evento: string;
  /** 'manual' | 'ia' | 'djen' | 'documento' (check da migration 0024). */
  origem: string;
};

/** Campos usados de `teses_caso` (0025). */
export type TeseCasoParaContexto = {
  /** PK — necessário para resolver `origem: "tese_cadastrada"` da estratégia. */
  id: string;
  tese: string;
  fundamentacao: string | null;
  /** 'em_avaliacao' | 'adotada' | 'descartada' (check da migration 0025). */
  status: string;
};

/** Campos usados de `tarefas_caso` (0027) com prioridade da 0043. */
export type TarefaCasoParaContexto = {
  titulo: string;
  /** 'pendente' | 'em_andamento' | 'concluida' (check da migration 0027). */
  status: string;
  /** 'baixa' | 'media' | 'alta' (check da migration 0043; default 'media'). */
  prioridade: string;
  /** date opcional "YYYY-MM-DD". */
  prazo_opcional: string | null;
};

/** Linha de `estrategias_caso` (0041) já filtrada para status='pronto'. */
export type EstrategiaProntaParaContexto = {
  /**
   * jsonb bruto do banco (shape esperado: `ResultadoEstrategiaCaso`,
   * `lib/estrategia-caso/tipos.ts`). Chega como `unknown` de propósito:
   * jsonb gravado por IA é estreitado defensivamente em
   * `estreitarResultadoEstrategia` — nunca confiar no shape sem validar.
   */
  resultado_estrategia: unknown;
};

export type EntradaMontagemContextoCaso = {
  pessoas: PessoaCasoParaContexto[];
  eventos: EventoCasoParaContexto[];
  teses: TeseCasoParaContexto[];
  tarefas: TarefaCasoParaContexto[];
  /** MAIS RECENTE estratégia com status='pronto' da ficha; `null` quando não há nenhuma. */
  estrategia: EstrategiaProntaParaContexto | null;
};

/**
 * Bloco extra mesclado no contexto do motor. Tipado estruturalmente (compatível
 * com `ContextoMailMergeCondicional` = `Record<string, ValorContextoTemplate>`)
 * para o merge `{...dados, ...contexto}` continuar sendo um spread simples.
 */
export type ContextoCasoExtra = {
  total_pessoas: number;
  total_eventos: number;
  total_tarefas: number;
  total_teses: number;
  /** Objetivo da estratégia pronta mais recente; "" quando não há estratégia. */
  estrategia_objetivo: string;
  /** Texto da tese principal (resolvendo referência a `teses_caso` quando necessário); "" quando ausente. */
  estrategia_tese_principal: string;
  pessoas: RegistroTemplate[];
  eventos: RegistroTemplate[];
  teses: RegistroTemplate[];
  tarefas: RegistroTemplate[];
};

/** Chaves raiz produzidas por este módulo — fonte única usada pelo teste do catálogo. */
export const CHAVES_RAIZ_CONTEXTO_CASO = [
  "total_pessoas",
  "total_eventos",
  "total_tarefas",
  "total_teses",
  "estrategia_objetivo",
  "estrategia_tese_principal",
] as const;

// ── Helpers puros ──────────────────────────────────────────────────────

/**
 * Formata data pt-BR aceitando tanto date "YYYY-MM-DD" (prazo_opcional,
 * mesmo truque `T00:00:00` do montar-dados) quanto timestamptz ISO
 * (data_evento). Inválida → `null` → "não informado" no motor.
 */
function formatarDataParaTemplate(dataBruta: string): string | null {
  const data = new Date(dataBruta.includes("T") ? dataBruta : `${dataBruta}T00:00:00`);
  if (Number.isNaN(data.getTime())) return null;
  return data.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/** Timestamp de ordenação; data inválida vai para o fim (nunca lança). */
function timestampDeOrdenacao(dataBruta: string): number {
  const tempo = new Date(dataBruta).getTime();
  return Number.isNaN(tempo) ? Number.POSITIVE_INFINITY : tempo;
}

/** String útil (trimada); vazia/não-string → `null` (dado ausente). */
function textoUtil(valor: string | null | undefined): string | null {
  const limpo = valor?.trim();
  return limpo && limpo.length > 0 ? limpo : null;
}

const PESOS_PRIORIDADE: Record<string, number> = { alta: 3, media: 2, baixa: 1 };

/** Prioridade desconhecida (varchar livre no banco) cai como 'media' — nunca lança. */
function pesoPrioridade(prioridade: string): number {
  return PESOS_PRIORIDADE[prioridade] ?? PESOS_PRIORIDADE.media;
}

/**
 * Ordena eventos por `data_evento` ascendente (linha do tempo cronológica —
 * o mais antigo primeiro, então o ÚLTIMO item é o evento mais recente).
 */
function compararEventosPorData(a: EventoCasoParaContexto, b: EventoCasoParaContexto): number {
  return timestampDeOrdenacao(a.data_evento) - timestampDeOrdenacao(b.data_evento);
}

/**
 * Ordena tarefas "pendentes primeiro": itens ativos (pendente/em_andamento)
 * antes das concluídas; dentro de cada grupo, prioridade desc (alta → baixa,
 * ordem do dashboard definida na migration 0043) e depois prazo mais próximo
 * (asc; sem prazo por último). `Array.sort` é estável, então empates mantêm
 * a ordem recebida do banco.
 */
function compararTarefasPendentesPrimeiro(a: TarefaCasoParaContexto, b: TarefaCasoParaContexto): number {
  const concluidaA = a.status === "concluida" ? 1 : 0;
  const concluidaB = b.status === "concluida" ? 1 : 0;
  if (concluidaA !== concluidaB) return concluidaA - concluidaB;

  const diferencaPrioridade = pesoPrioridade(b.prioridade) - pesoPrioridade(a.prioridade);
  if (diferencaPrioridade !== 0) return diferencaPrioridade;

  const prazoA = a.prazo_opcional ? timestampDeOrdenacao(`${a.prazo_opcional}T00:00:00`) : Number.POSITIVE_INFINITY;
  const prazoB = b.prazo_opcional ? timestampDeOrdenacao(`${b.prazo_opcional}T00:00:00`) : Number.POSITIVE_INFINITY;
  return prazoA - prazoB;
}

// ── Estreitamento defensivo do jsonb da estratégia ─────────────────────

type ResultadoEstrategiaEstreito = { objetivo: string; tesePrincipal: string };

/** Só aceita string não-vazia (trimada); qualquer outra coisa = dado ausente. */
function textoComoString(valor: unknown): string | null {
  return typeof valor === "string" ? textoUtil(valor) : null;
}

/**
 * Valida o mínimo necessário do jsonb `resultado_estrategia` (shape de
 * `ResultadoEstrategiaCaso`, ADR 0014) SEM Zod — mesmo nível de confiança do
 * resto deste módulo: campos checados um a um, qualquer desvio vira ""
 * ("não informado"), nunca exceção. A tese principal pode vir por
 * referência (`origem: "tese_cadastrada"` guarda apenas o ID) — nesse caso o
 * texto é resolvido contra as teses da própria ficha já carregadas; ID
 * inexistente na ficha → "" (a IA nunca inventa conteúdo aqui dentro).
 */
function estreitarResultadoEstrategia(
  jsonb: unknown,
  tesesDaFicha: TeseCasoParaContexto[],
): ResultadoEstrategiaEstreito {
  if (typeof jsonb !== "object" || jsonb === null) return { objetivo: "", tesePrincipal: "" };
  const resultado = jsonb as Record<string, unknown>;
  const objetivo = textoComoString(resultado["objetivo"]) ?? "";

  let tesePrincipal = "";
  if (Array.isArray(resultado["teses"])) {
    for (const item of resultado["teses"]) {
      if (typeof item !== "object" || item === null) continue;
      const tese = item as Record<string, unknown>;
      if (tese["papel"] !== "principal") continue;

      if (tese["origem"] === "sugerida") {
        // Tese proposta pela IA em texto livre — o texto está no próprio jsonb.
        tesePrincipal = textoComoString(tese["tese"]) ?? "";
      } else if (tese["origem"] === "tese_cadastrada") {
        // Referência a `teses_caso` — reconcilia com o dado vivo da ficha
        // (mesmo racional do ADR 0014, seção 2: nunca duplicar texto congelado).
        const id = typeof tese["teseCasoId"] === "string" ? tese["teseCasoId"] : null;
        const cadastrada = id ? tesesDaFicha.find((t) => t.id === id) : undefined;
        tesePrincipal = cadastrada ? cadastrada.tese : "";
      }
      break; // primeira "principal" do array define o valor (contrato: exatamente 1)
    }
  }

  return { objetivo, tesePrincipal };
}

// ── Mapeamentos por coleção ────────────────────────────────────────────

function mapearPessoa(pessoa: PessoaCasoParaContexto, indice: number): RegistroTemplate {
  return {
    indice: indice + 1,
    nome: pessoa.nome,
    // Papel macro da pessoa no caso ('parte'/'adverso'/...) — permite
    // `{{#se tipo == "adverso"}}` dentro de `{{#cada pessoas}}`.
    tipo: pessoa.tipo,
    papel_processual: pessoa.papel_processual,
    documento: pessoa.documento,
    contato: pessoa.contato,
    // Derivados: flags prontas para condicionais, sem o usuário ter que
    // lembrar do valor exato de `tipo` ou conferir campo vazio no template.
    adversa: pessoa.tipo === "adverso",
    tem_documento: textoUtil(pessoa.documento) !== null,
    tem_contato: textoUtil(pessoa.contato) !== null,
  };
}

function mapearEvento(evento: EventoCasoParaContexto, indice: number, ultimoIndice: number): RegistroTemplate {
  return {
    indice: indice + 1,
    // `ultimo` marca o evento mais recente da linha do tempo (lista ordenada
    // por data asc) — permite destacar "última movimentação" no documento.
    ultimo: indice === ultimoIndice,
    data: formatarDataParaTemplate(evento.data_evento),
    descricao: evento.descricao,
    tipo_evento: evento.tipo_evento,
    origem: evento.origem,
  };
}

function mapearTese(tese: TeseCasoParaContexto, indice: number): RegistroTemplate {
  return {
    indice: indice + 1,
    tese: tese.tese,
    fundamentacao: tese.fundamentacao,
    status: tese.status,
    // Derivado: `{{#se adotada}}` em vez de decorar status == "adotada".
    adotada: tese.status === "adotada",
  };
}

function mapearTarefa(tarefa: TarefaCasoParaContexto, indice: number): RegistroTemplate {
  const hoje = new Date();
  const prazo = tarefa.prazo_opcional ? new Date(`${tarefa.prazo_opcional}T00:00:00`) : null;
  const concluida = tarefa.status === "concluida";
  // Mesmo critério de `atrasada` de `mapearParcela` (montar-dados): vencida e
  // ainda ativa — nunca depende do usuário atualizar um status manualmente.
  const atrasada =
    !concluida && prazo !== null && !Number.isNaN(prazo.getTime()) && prazo.getTime() < hoje.getTime();

  return {
    indice: indice + 1,
    titulo: tarefa.titulo,
    status: tarefa.status,
    prioridade: tarefa.prioridade,
    prazo: tarefa.prazo_opcional ? formatarDataParaTemplate(tarefa.prazo_opcional) : null,
    concluida,
    atrasada,
  };
}

/**
 * Monta o bloco de contexto do Caso Inteligente. Função PURA e total: ficha
 * recém-criada (todas as coleções vazias + estratégia null) devolve totais 0,
 * arrays vazios e strings vazias — o motor trata "" como "não informado".
 */
export function montarContextoCaso(entrada: EntradaMontagemContextoCaso): ContextoCasoExtra {
  const eventosOrdenados = [...entrada.eventos].sort(compararEventosPorData);
  const tarefasOrdenadas = [...entrada.tarefas].sort(compararTarefasPendentesPrimeiro);
  const estrategia = entrada.estrategia
    ? estreitarResultadoEstrategia(entrada.estrategia.resultado_estrategia, entrada.teses)
    : { objetivo: "", tesePrincipal: "" };

  return {
    total_pessoas: entrada.pessoas.length,
    total_eventos: entrada.eventos.length,
    total_tarefas: entrada.tarefas.length,
    total_teses: entrada.teses.length,
    estrategia_objetivo: estrategia.objetivo,
    estrategia_tese_principal: estrategia.tesePrincipal,
    pessoas: entrada.pessoas.map(mapearPessoa),
    eventos: eventosOrdenados.map((evento, indice) =>
      mapearEvento(evento, indice, eventosOrdenados.length - 1),
    ),
    teses: entrada.teses.map(mapearTese),
    tarefas: tarefasOrdenadas.map(mapearTarefa),
  };
}
