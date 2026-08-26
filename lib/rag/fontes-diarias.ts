import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { sincronizarTodosEscritorios } from "@/lib/djen/sincronizar";
import { sincronizarJurisprudenciaStj } from "@/lib/jurisprudencia/stj";
import type { StatusExecucaoRag } from "./execucao";

/**
 * Registro central das fontes que alimentam a base de conhecimento jurídico
 * (item P0.4). Cada entrada é um ADAPTADOR fino sobre um pipeline de ingestão
 * que JÁ existe e já está testado no projeto · este arquivo não reimplementa
 * busca, chunking, embedding nem deduplicação:
 *
 *   - `djen` .............. `lib/djen/sincronizar.ts` (comunicações/movimentações)
 *   - `stj_dados_abertos` . `lib/jurisprudencia/stj.ts` (Espelhos de Acórdão, CC-BY)
 *
 * O que este módulo acrescenta em cima deles é o que faltava para o critério
 * de aceite do P0.4: um orquestrador único que roda todas as fontes na mesma
 * execução diária, isola falha por fonte (uma fonte fora do ar não derruba as
 * outras), avança o cursor de incrementalidade e grava o resultado em
 * `rag_execucao_log`.
 *
 * ── Por que não existe uma fonte `legislacao` aqui ──────────────────────────
 * O pacote de referência recebido (`docs/referencia/rag-juridico-diario/`)
 * previa `buscarAtualizacoesLegislacao()` apontando para LexML ou Planalto,
 * com dados de exemplo no lugar da integração. NÃO foi plugado, e o slot está
 * deliberadamente ausente em vez de presente-e-mockado: uma fonte registrada
 * que devolve conteúdo de exemplo entraria no `embeddings_chunks` real e
 * viraria "contexto jurídico atualizado" citável pela IA numa peça · risco
 * jurídico direto, que é exatamente o que o P0.4 existe para evitar. Mesmo
 * critério já adotado em `lib/rag/jurisprudencia.ts` para a jurisprudência
 * antes de o portal de dados abertos do STJ ser confirmado como fonte real.
 *
 * PRÓXIMO PASSO para legislação (decisão de fonte, não de código): o LexML
 * expõe busca via SRU e o Planalto publica HTML sem contrato estável. Antes
 * de virar uma entrada aqui, precisa de (1) confirmação de que a fonte
 * devolve TEXTO consolidado e não só metadados, (2) um parser dedicado por
 * formato, e (3) decisão sobre licença de redistribuição do texto legal.
 * Enquanto isso não existir, `legislacao` fica fora do registro e a IA
 * continua avisando (via RAG_TOOLING_PROMPT) quando não teve embasamento
 * verificado na base.
 */

export type ResultadoFonteDiaria = {
  status: StatusExecucaoRag;
  documentosNovos: number;
  documentosFalha: number;
  mensagemErro?: string;
  detalhes?: Record<string, unknown>;
};

export type FonteDiaria = {
  /** Chave estável: é a PK em `rag_fonte_cursor` e o agrupador em `rag_execucao_log`. Nunca renomear sem migração de dados. */
  nome: string;
  descricao: string;
  /**
   * `true` quando a fonte tem o próprio controle de idempotência mais forte
   * que um cursor de data (o STJ compara o NOME do arquivo mensal já
   * ingerido, em `fontes_stj_sync.ultimo_arquivo`). Nesses casos o cursor
   * ainda é gravado (serve de rastro de "quando tentamos pela última vez"),
   * mas não é passado para o adaptador · passar uma data faria o job parecer
   * incremental por data quando não é, e alguém confiaria nisso depois.
   */
  ignoraCursor: boolean;
  executar: (supabase: SupabaseClient, desde: Date) => Promise<ResultadoFonteDiaria>;
};

/**
 * DJEN: comunicações processuais por OAB de cada escritório. O adaptador
 * reaproveita `sincronizarTodosEscritorios`, que já mantém o próprio
 * checkpoint por OAB e já filtra o que virou proposta antes · o `desde` do
 * cursor não é repassado justamente para não haver dois relógios brigando
 * pela mesma janela.
 */
const fonteDjen: FonteDiaria = {
  nome: "djen",
  descricao: "Comunicações e movimentações do DJEN por OAB cadastrada",
  ignoraCursor: true,
  executar: async (supabase) => {
    const resultados = await sincronizarTodosEscritorios(supabase);
    const falhas = resultados.filter((r) => !r.ok);
    const propostasCriadas = resultados.reduce((soma, r) => soma + r.propostasCriadas, 0);

    return {
      // Nenhuma OAB cadastrada ainda: não é sucesso (não houve trabalho) nem
      // erro (nada está quebrado) · 'pulado' evita que o alerta de saúde
      // acuse falha num escritório que simplesmente não usa o DJEN.
      status: resultados.length === 0 ? "pulado" : falhas.length > 0 ? "sucesso_parcial" : "sucesso",
      documentosNovos: propostasCriadas,
      documentosFalha: falhas.length,
      mensagemErro: falhas.length > 0 ? falhas.map((f) => `${f.oab}: ${f.erro ?? "erro"}`).join("; ") : undefined,
      detalhes: { oabsProcessadas: resultados.length, propostasCriadas },
    };
  },
};

/**
 * STJ (Espelhos de Acórdão, dados abertos CC-BY). Publicação é MENSAL, mas o
 * adaptador roda no job diário de propósito: `sincronizarOrgaoStj` só baixa
 * quando o arquivo é mais recente que o já registrado, então 29 dos 30 dias
 * do mês custam apenas a leitura dos metadados CKAN · em troca, o mês novo
 * entra na base no dia em que é publicado, em vez de esperar até o dia 3 do
 * mês seguinte (o cron mensal existente). O cron mensal continua no
 * `vercel.json` como rede de segurança se o diário falhar por dias.
 */
const fonteStj: FonteDiaria = {
  nome: "stj_dados_abertos",
  descricao: "Espelhos de Acórdão do STJ (portal de dados abertos, CC-BY)",
  ignoraCursor: true,
  executar: async (supabase) => {
    const resultados = await sincronizarJurisprudenciaStj(supabase);
    const erros = resultados.filter((r) => r.status === "erro");
    const registrosNovos = resultados.reduce((soma, r) => soma + (r.registrosNovos ?? 0), 0);
    const errosIngestao = resultados.reduce((soma, r) => soma + (r.errosIngestao ?? 0), 0);
    const todosPulados = resultados.length > 0 && resultados.every((r) => r.status === "pulado");

    return {
      // Todos os órgãos já com o arquivo do mês ingerido: 'pulado', o caso
      // normal em 29 de 30 dias. Não conta como erro nem infla "novos".
      status:
        resultados.length === 0
          ? "pulado"
          : todosPulados
            ? "pulado"
            : erros.length > 0 || errosIngestao > 0
              ? "sucesso_parcial"
              : "sucesso",
      documentosNovos: registrosNovos,
      documentosFalha: erros.length + errosIngestao,
      mensagemErro:
        erros.length > 0 ? erros.map((e) => `${e.orgaoJulgador}: ${e.mensagemErro ?? "erro"}`).join("; ") : undefined,
      detalhes: {
        orgaos: resultados.length,
        ok: resultados.filter((r) => r.status === "ok").length,
        pulados: resultados.filter((r) => r.status === "pulado").length,
        erros: erros.length,
        registrosNovos,
      },
    };
  },
};

export const FONTES_DIARIAS: readonly FonteDiaria[] = [fonteDjen, fonteStj];

export const NOMES_FONTES_DIARIAS: readonly string[] = FONTES_DIARIAS.map((f) => f.nome);
