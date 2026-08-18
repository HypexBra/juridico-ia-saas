import "server-only";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { indexarJurisprudenciaChunk } from "./ingestao";

/**
 * Ingestão de jurisprudência (STF/STJ) para o RAG compartilhado (migration
 * 0008: tabela `jurisprudencias`, global, sem `escritorio_id`).
 *
 * PESQUISADO E NÃO ENCONTRADO (ver relatório desta sessão): uma API pública,
 * gratuita e sem burocracia de credenciamento que devolva TEXTO de ementas/
 * acórdãos do STF/STJ pesquisável por conteúdo.
 *   - DataJud (CNJ) é pública e gratuita, mas só devolve METADADOS
 *     processuais (classe, assunto, movimentação) — não o texto do
 *     acórdão/ementa, então não serve como fonte de conteúdo para RAG.
 *   - Os portais de dados abertos do STJ/STF disponibilizam exportações em
 *     lote (XML/RSS do Diário de Justiça eletrônico), não uma API de busca
 *     por conteúdo — integrar isso é um parser dedicado por tribunal, fora
 *     do escopo desta sessão (ver nota final).
 * Por isso este módulo implementa o pipeline de ingestão MANUAL: um
 * operador (ou um processo futuro de scraping/parsing dos exports em lote)
 * fornece uma lista estruturada de jurisprudências (JSON, não CSV bruto —
 * ementa jurídica real quase sempre contém vírgulas/quebras de linha, o que
 * torna parsing de CSV ingênuo, sem lib dedicada, frágil o suficiente para
 * corromper dado jurídico; a alternativa segura sem dependência nova é pedir
 * o already-estruturado JSON, que qualquer planilha/CSV exporta em 1 passo).
 *
 * PRÓXIMO PASSO (não implementado agora, documentado para não fingir que
 * está pronto): um job de scraping dos exports XML/RSS do DJe do STJ (ou do
 * portal público jurisprudencia.stj.jus.br / portal.stf.jus.br) que
 * transforma o formato de cada tribunal neste mesmo shape JSON antes de
 * chamar `indexarJurisprudencias`. Isso é trabalho de parser específico por
 * tribunal (formato de XML/HTML muda entre STF e STJ) — não uma chamada de
 * API simples, por isso ficou fora deste pipeline.
 */

export const jurisprudenciaInputSchema = z.object({
  tribunal: z.enum(["stf", "stj"]),
  numero_processo: z.string().trim().min(1).max(50),
  classe: z.string().trim().max(100).optional(),
  relator: z.string().trim().max(255).optional(),
  ementa: z.string().trim().min(1),
  inteiro_teor_url: z.string().url().optional(),
  data_julgamento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve ser YYYY-MM-DD")
    .optional(),
  data_publicacao: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve ser YYYY-MM-DD")
    .optional(),
  termo_busca: z.string().trim().max(255).optional(),
});

export type JurisprudenciaInput = z.infer<typeof jurisprudenciaInputSchema>;

export type ResultadoIngestaoJurisprudencia = {
  numeroProcesso: string;
  ok: boolean;
  totalChunks?: number;
  erro?: string;
};

/**
 * Faz upsert de cada jurisprudência (chave natural: tribunal+numero_processo,
 * ver constraint UNIQUE da migration 0008) e reindexa a ementa como chunks
 * compartilhados. SEMPRE chamar com `createAdminClient()` (service_role) —
 * `jurisprudencias`/`embeddings_chunks` não dão insert para usuário comum de
 * propósito (dado global, não pertence a nenhum tenant).
 */
export async function indexarJurisprudencias(
  supabase: SupabaseClient,
  itens: JurisprudenciaInput[],
): Promise<ResultadoIngestaoJurisprudencia[]> {
  const resultados: ResultadoIngestaoJurisprudencia[] = [];

  for (const item of itens) {
    try {
      const { data: registro, error: erroUpsert } = await supabase
        .from("jurisprudencias")
        .upsert(
          {
            tribunal: item.tribunal,
            numero_processo: item.numero_processo,
            classe: item.classe ?? null,
            relator: item.relator ?? null,
            ementa: item.ementa,
            inteiro_teor_url: item.inteiro_teor_url ?? null,
            data_julgamento: item.data_julgamento ?? null,
            data_publicacao: item.data_publicacao ?? null,
            termo_busca: item.termo_busca ?? null,
          },
          { onConflict: "tribunal,numero_processo" },
        )
        .select("id")
        .single();

      if (erroUpsert || !registro) {
        resultados.push({
          numeroProcesso: item.numero_processo,
          ok: false,
          erro: erroUpsert?.message ?? "Falha ao gravar jurisprudência.",
        });
        continue;
      }

      const { totalChunks } = await indexarJurisprudenciaChunk(supabase, {
        jurisprudenciaId: registro.id,
        texto: item.ementa,
        metadata: {
          tribunal: item.tribunal,
          numero_processo: item.numero_processo,
          classe: item.classe ?? null,
          relator: item.relator ?? null,
          data_julgamento: item.data_julgamento ?? null,
          // Guardado na própria metadata do chunk (não só na tabela
          // `jurisprudencias`) para a citação clicável no chat não precisar
          // de um JOIN extra na hora de montar o link da fonte.
          inteiro_teor_url: item.inteiro_teor_url ?? null,
        },
      });

      resultados.push({ numeroProcesso: item.numero_processo, ok: true, totalChunks });
    } catch (erro) {
      resultados.push({
        numeroProcesso: item.numero_processo,
        ok: false,
        erro: erro instanceof Error ? erro.message : "Erro desconhecido na ingestão.",
      });
    }
  }

  return resultados;
}
