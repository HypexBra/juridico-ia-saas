/**
 * Agregações PURAS sobre os registros de `uso_ia` (observabilidade de IA,
 * migration 0045) — sem I/O: a página `/app/uso` busca as linhas via
 * Supabase (RLS garante isolamento por escritório) e delega TODO o cálculo
 * para cá, mantendo as funções determinísticas e testáveis.
 *
 * Fuso: a janela diária usa a data UTC do `criado_em` (mesma convenção de
 * `mes_ref` em lib/ia/registro-uso.ts#mesReferencia), então agregação e
 * limite mensal sempre falam da mesma fronteira temporal.
 */

/** Linha mínima de `uso_ia` consumida pelas agregações. */
export type RegistroUsoIa = {
  criado_em: string;
  mes_ref: string;
  tokens_in: number;
  tokens_out: number;
  duracao_ms: number | null;
  modelo: string | null;
  origem: string | null;
};

/** Preço público de referência em USD por 1M de tokens. */
export type PrecoModelo = { entrada: number; saida: number };

/**
 * Tabela de preços PÚBLICOS de referência (USD/1M tokens, tier pago) para os
 * nomes de modelo EXATOS usados pelas chamadas de IA do projeto:
 * - `gemini-flash-latest` / `gemini-flash-lite-latest`: constantes de
 *   lib/ia/gemini.ts (MODELO_FLASH/MODELO_PRO e MODELO_FALLBACK_QUOTA);
 * - `openai/gpt-oss-120b`: MODELO_GROQ de lib/ia/groq.ts;
 * - `gemini-embedding-001`: MODELO_EMBEDDING de lib/rag/embeddings.ts
 *   (embeddings só têm token de entrada — saída fica 0).
 *
 * Valores aproximados coletados das tabelas públicas dos provedores
 * (ago/2026). O alias "-latest" pode migrar de geração sem aviso — revisar
 * estes números periodicamente. Qualquer modelo fora desta tabela NUNCA tem
 * custo inventado: aparece como "—" na UI (ver calcularCustoEstimado).
 */
export const PRECOS_POR_MILHAO: Record<string, PrecoModelo> = {
  "gemini-flash-latest": { entrada: 1.5, saida: 7.5 },
  "gemini-flash-lite-latest": { entrada: 0.15, saida: 1.25 },
  "openai/gpt-oss-120b": { entrada: 0.15, saida: 0.6 },
  "gemini-embedding-001": { entrada: 0.15, saida: 0 },
};

export type CustoEstimado = {
  /**
   * Total estimado em USD — `null` quando NENHUM registro é precificável
   * (zero registros ou todos com modelo desconhecido): a UI mostra "—"
   * em vez de um valor fabricado.
   */
  totalUsd: number | null;
  /** Registros que entraram no cálculo. */
  registrosPrecificados: number;
  /** Total de registros recebidos (precificados + fora do cálculo). */
  registrosTotal: number;
};

/**
 * Estimativa HONESTA de custo: soma (tokens/1M × preço) apenas dos registros
 * cujo `modelo` está presente na tabela passada. Modelos desconhecidos (ou
 * nulos — gravações antigas anteriores à migration 0045) ficam FORA do
 * cálculo, nunca com preço chutado.
 */
export function calcularCustoEstimado(
  registros: RegistroUsoIa[],
  precos: Record<string, PrecoModelo>,
): CustoEstimado {
  let totalUsd = 0;
  let registrosPrecificados = 0;

  for (const registro of registros) {
    const preco = registro.modelo ? precos[registro.modelo] : undefined;
    if (!preco) continue;
    totalUsd += ((registro.tokens_in || 0) / 1_000_000) * preco.entrada;
    totalUsd += ((registro.tokens_out || 0) / 1_000_000) * preco.saida;
    registrosPrecificados += 1;
  }

  return {
    totalUsd: registrosPrecificados > 0 ? totalUsd : null,
    registrosPrecificados,
    registrosTotal: registros.length,
  };
}

export type TotaisPeriodo = {
  chamadas: number;
  tokensIn: number;
  tokensOut: number;
  /** Média das durações registradas — `null` quando nenhuma chamada tem duração. */
  duracaoMediaMs: number | null;
};

/** Totais simples do período: chamadas, tokens e duração média (ignora nulls). */
export function agregarTotais(registros: RegistroUsoIa[]): TotaisPeriodo {
  let chamadas = 0;
  let tokensIn = 0;
  let tokensOut = 0;
  let somaDuracoes = 0;
  let comDuracao = 0;

  for (const registro of registros) {
    chamadas += 1;
    tokensIn += registro.tokens_in || 0;
    tokensOut += registro.tokens_out || 0;
    if (typeof registro.duracao_ms === "number" && Number.isFinite(registro.duracao_ms)) {
      somaDuracoes += registro.duracao_ms;
      comDuracao += 1;
    }
  }

  return {
    chamadas,
    tokensIn,
    tokensOut,
    duracaoMediaMs: comDuracao > 0 ? Math.round(somaDuracoes / comDuracao) : null,
  };
}

export type UsoPorDia = {
  /** Dia UTC no formato "YYYY-MM-DD". */
  dia: string;
  /** Rótulo curto "DD/MM" para exibição. */
  rotulo: string;
  chamadas: number;
  tokens: number;
};

function chaveDia(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Série diária com JANELA FIXA dos últimos `dias` dias (incluindo hoje),
 * preenchida com zero nos dias sem uso — barras vazias são informação real
 * ("dia parado"), não buraco de dados. Registros fora da janela são ignorados.
 * Ordenação cronológica garantida (mais antigo → mais recente).
 */
export function agregarPorDia(registros: RegistroUsoIa[], hoje: Date, dias = 30): UsoPorDia[] {
  const serie: UsoPorDia[] = [];
  const indicePorDia = new Map<string, number>();

  for (let offset = dias - 1; offset >= 0; offset--) {
    const data = new Date(hoje.getTime() - offset * 24 * 60 * 60 * 1000);
    const chave = data.toISOString().slice(0, 10);
    indicePorDia.set(chave, serie.length);
    serie.push({
      dia: chave,
      rotulo: `${chave.slice(8, 10)}/${chave.slice(5, 7)}`,
      chamadas: 0,
      tokens: 0,
    });
  }

  for (const registro of registros) {
    const indice = indicePorDia.get(chaveDia(registro.criado_em));
    if (indice === undefined) continue;
    const bucket = serie[indice];
    if (!bucket) continue;
    bucket.chamadas += 1;
    bucket.tokens += (registro.tokens_in || 0) + (registro.tokens_out || 0);
  }

  return serie;
}

export type UsoPorOrigem = {
  origem: string;
  chamadas: number;
  tokens: number;
};

/**
 * Agregação por origem funcional (chat, analise_ficha, radar_briefing…),
 * ordenada por chamadas decrescente e limitada ao top `top`. Registros sem
 * origem (gravações antigas) aparecem agrupados como "—" em vez de sumirem.
 */
export function agregarPorOrigem(registros: RegistroUsoIa[], top = 8): UsoPorOrigem[] {
  const acumulado = new Map<string, UsoPorOrigem>();

  for (const registro of registros) {
    const chave = registro.origem?.trim() || "—";
    const linha = acumulado.get(chave) ?? { origem: chave, chamadas: 0, tokens: 0 };
    linha.chamadas += 1;
    linha.tokens += (registro.tokens_in || 0) + (registro.tokens_out || 0);
    acumulado.set(chave, linha);
  }

  return [...acumulado.values()]
    .sort((a, b) => b.chamadas - a.chamadas || b.tokens - a.tokens)
    .slice(0, top);
}
