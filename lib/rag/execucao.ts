import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cursor de incrementalidade + log de execução dos jobs que alimentam a base
 * jurídica (migration 0048, item P0.4 do backlog).
 *
 * Todas as funções aqui escrevem em `rag_fonte_cursor` / `rag_execucao_log`,
 * que não têm policy de INSERT/UPDATE: precisam ser chamadas com
 * `createAdminClient()` (service_role), no mesmo padrão dos outros jobs de
 * cron do projeto. Um client de sessão de usuário falharia silenciosamente
 * nas escritas (RLS nega), e é justamente por isso que as escritas aqui
 * NUNCA são best-effort silenciosas: um cursor que não avança faz o job
 * reprocessar a mesma janela para sempre, e um log que não grava zera o
 * alerta de saúde · os dois casos precisam aparecer.
 */

export type StatusExecucaoRag = "sucesso" | "sucesso_parcial" | "erro" | "pulado";

/**
 * Janela inicial da PRIMEIRA execução de uma fonte (quando ainda não há
 * cursor). 30 dias: janela grande o suficiente para a base não nascer vazia,
 * pequena o suficiente para a primeira execução não estourar o `maxDuration`
 * da função serverless gerando embedding de meio ano de publicações.
 */
const JANELA_PRIMEIRA_EXECUCAO_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Limite padrão do alerta do P0.4: se uma fonte não teve NENHUMA execução
 * bem-sucedida nesse intervalo, o time precisa ser avisado. 26h (não 24h) de
 * propósito: um cron diário que atrasa alguns minutos, ou uma execução que
 * cai exatamente no horário de verão/reinício da Vercel, não deve disparar
 * alerta falso · o alerta só vale se tiver credibilidade.
 */
export const HORAS_SEM_SUCESSO_PARA_ALERTAR = 26;

/**
 * Lê o cursor da fonte. Retorna a data a partir da qual buscar: o
 * `ultima_busca_em` gravado, ou (primeira execução) `agora - 30 dias`.
 *
 * Nunca lança por ausência de linha · "fonte nova" é o caso normal na
 * primeira execução, não um erro. Lança se a LEITURA falhar de verdade
 * (banco indisponível), porque nesse caso assumir "últimos 30 dias" faria o
 * job reprocessar uma janela enorme por causa de uma falha transitória.
 */
export async function lerCursorFonte(
  supabase: SupabaseClient,
  fonte: string,
  agora: Date = new Date(),
): Promise<Date> {
  const { data, error } = await supabase
    .from("rag_fonte_cursor")
    .select("ultima_busca_em")
    .eq("fonte", fonte)
    .maybeSingle<{ ultima_busca_em: string }>();

  if (error) {
    throw new Error(`Falha ao ler cursor da fonte "${fonte}": ${error.message}`);
  }

  if (!data?.ultima_busca_em) {
    return new Date(agora.getTime() - JANELA_PRIMEIRA_EXECUCAO_MS);
  }

  return new Date(data.ultima_busca_em);
}

/**
 * Avança o cursor da fonte para `marcoInicioBusca` · o instante capturado
 * ANTES de a busca começar, nunca `new Date()` no fim. Ver comentário da
 * coluna na migration 0048: usar o fim da execução perderia tudo que foi
 * publicado enquanto o job rodava.
 *
 * Só deve ser chamado quando a fonte foi processada até o fim sem exceção
 * não tratada. Se o job quebrar no meio, deixar o cursor onde estava faz a
 * próxima execução tentar a MESMA janela de novo · reprocessar é inofensivo
 * (ingestão idempotente), pular conteúdo jurídico não é.
 */
export async function avancarCursorFonte(
  supabase: SupabaseClient,
  fonte: string,
  marcoInicioBusca: Date,
): Promise<void> {
  const { error } = await supabase.from("rag_fonte_cursor").upsert(
    {
      fonte,
      ultima_busca_em: marcoInicioBusca.toISOString(),
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: "fonte" },
  );

  if (error) {
    throw new Error(`Falha ao avançar cursor da fonte "${fonte}": ${error.message}`);
  }
}

export type RegistroExecucaoRag = {
  fonte: string;
  status: StatusExecucaoRag;
  documentosNovos?: number;
  documentosFalha?: number;
  duracaoMs?: number;
  mensagemErro?: string | null;
  detalhes?: Record<string, unknown> | null;
};

/**
 * Grava uma linha no histórico de execução. Best-effort DE PROPÓSITO (não
 * lança): este log existe para dar visibilidade, e uma falha ao gravá-lo não
 * pode transformar uma sincronização que deu certo em erro reportado ao
 * cron · mas nunca falha em silêncio, o `console.error` estruturado abaixo é
 * o que sobra no log da Vercel quando o próprio banco de log está fora.
 */
export async function registrarExecucaoRag(
  supabase: SupabaseClient,
  registro: RegistroExecucaoRag,
): Promise<void> {
  const { error } = await supabase.from("rag_execucao_log").insert({
    fonte: registro.fonte,
    status: registro.status,
    documentos_novos: registro.documentosNovos ?? 0,
    documentos_falha: registro.documentosFalha ?? 0,
    duracao_ms: registro.duracaoMs ?? null,
    mensagem_erro: registro.mensagemErro ?? null,
    detalhes: registro.detalhes ?? null,
  });

  if (error) {
    console.error(
      JSON.stringify({
        evento: "rag_execucao_log_insert_falhou",
        fonte: registro.fonte,
        status: registro.status,
        erroLog: error.message,
      }),
    );
  }
}

export type SaudeFonteRag = {
  fonte: string;
  ultimaExecucaoEm: string | null;
  ultimoSucessoEm: string | null;
  ultimoStatus: StatusExecucaoRag | null;
  ultimaMensagemErro: string | null;
  /** Horas desde o último sucesso, ou `null` se a fonte nunca teve sucesso registrado. */
  horasSemSucesso: number | null;
  /** `true` quando a fonte passou de `HORAS_SEM_SUCESSO_PARA_ALERTAR` sem sucesso (ou nunca teve nenhum). */
  precisaAlerta: boolean;
};

/**
 * Resumo de saúde de todas as fontes que já executaram alguma vez, via RPC
 * `rag_saude_fontes()` (uma chamada, não N).
 *
 * `fontesEsperadas` existe porque a RPC só consegue enxergar o que JÁ rodou:
 * uma fonte registrada no código mas cujo cron nunca disparou não tem
 * nenhuma linha em `rag_execucao_log` e, sem essa lista, sairia do relatório
 * como se não existisse · exatamente o silêncio que o P0.4 quer evitar. Ela
 * entra no resultado com `ultimoSucessoEm: null` e `precisaAlerta: true`.
 */
export async function lerSaudeFontesRag(
  supabase: SupabaseClient,
  fontesEsperadas: readonly string[],
  agora: Date = new Date(),
): Promise<SaudeFonteRag[]> {
  const { data, error } = await supabase.rpc("rag_saude_fontes");
  if (error) {
    throw new Error(`Falha ao ler saúde das fontes RAG: ${error.message}`);
  }

  const linhas = (data ?? []) as Array<{
    fonte: string;
    ultima_execucao_em: string | null;
    ultimo_sucesso_em: string | null;
    ultimo_status: StatusExecucaoRag | null;
    ultima_mensagem_erro: string | null;
  }>;

  const porFonte = new Map(linhas.map((linha) => [linha.fonte, linha]));
  const nomes = [...new Set([...fontesEsperadas, ...porFonte.keys()])];

  return nomes.map((fonte) => {
    const linha = porFonte.get(fonte);
    return montarSaudeFonte(
      fonte,
      {
        ultimaExecucaoEm: linha?.ultima_execucao_em ?? null,
        ultimoSucessoEm: linha?.ultimo_sucesso_em ?? null,
        ultimoStatus: linha?.ultimo_status ?? null,
        ultimaMensagemErro: linha?.ultima_mensagem_erro ?? null,
      },
      agora,
    );
  });
}

/**
 * Núcleo puro do cálculo de saúde de UMA fonte · separado de `lerSaudeFontesRag`
 * para ser testável sem Supabase (é aqui que mora a regra de negócio do
 * alerta, não na query).
 */
export function montarSaudeFonte(
  fonte: string,
  dados: {
    ultimaExecucaoEm: string | null;
    ultimoSucessoEm: string | null;
    ultimoStatus: StatusExecucaoRag | null;
    ultimaMensagemErro: string | null;
  },
  agora: Date = new Date(),
): SaudeFonteRag {
  const horasSemSucesso = dados.ultimoSucessoEm
    ? (agora.getTime() - new Date(dados.ultimoSucessoEm).getTime()) / 3_600_000
    : null;

  return {
    fonte,
    ...dados,
    horasSemSucesso,
    // Nunca teve sucesso => alerta. Isso cobre tanto "fonte nova cujo cron
    // nunca disparou" quanto "fonte que só falha desde o primeiro dia" · nos
    // dois casos a base jurídica está velha e ninguém sabe.
    precisaAlerta: horasSemSucesso === null || horasSemSucesso > HORAS_SEM_SUCESSO_PARA_ALERTAR,
  };
}
