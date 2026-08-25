import "server-only";

import { gerarRespostaEstruturada } from "../ia/chamada-estruturada";
import { mensagemErroIaParaUsuario } from "../ia/erros";
import { montarContextoEstrategiaCaso, type DadosContextoEstrategiaCaso } from "./contexto";
import {
  ESTRATEGISTA_CASO_RESPONSE_SCHEMA,
  ESTRATEGISTA_CASO_SYSTEM_PROMPT,
  montarPromptEstrategiaCaso,
  parsearRespostaEstrategiaCaso,
} from "./prompt";
import type { ResultadoEstrategiaCaso } from "./tipos";

/**
 * Modelo isolado desta feature — mesmo racional de
 * `lib/advogado-contra/analisar.ts`/`lib/auditoria-peca/auditar.ts`: não
 * reaproveita as constantes de `lib/ia/gemini.ts` (chat) para não acoplar o
 * teto de tokens/retry do chat a esta análise. Nomes de alias (não versão
 * fixa) — nomes fixos de modelo já causaram indisponibilidade no passado
 * (ver `.agents/memoria/erros-corrigidos.md`).
 */
const MODELO_ESTRATEGIA_CASO = "gemini-flash-latest";
const MODELO_FALLBACK_QUOTA_ESTRATEGIA_CASO = "gemini-flash-lite-latest";

/** Saída potencialmente maior que as features "one-shot" (7 arrays no
 * schema, agregando múltiplas fontes) — teto de tokens mais alto que
 * Advogado do Contra/Auditor de Peças (8192) para não truncar a resposta
 * de um caso com histórico extenso. */
export const MAX_OUTPUT_TOKENS_ESTRATEGIA_CASO = 12_288;
export const THINKING_BUDGET_ESTRATEGIA_CASO = 1024;

/** Contadores leves persistidos em `estrategias_caso.contexto_resumo`
 * (ADR 0014, seção 1) — montado a partir dos MESMOS dados de entrada, nunca
 * vindo da resposta da IA (é metadado de "o que foi lido", não um achado). */
export type ContextoResumoEstrategiaCaso = {
  totalTeses: number;
  totalEventos: number;
  totalPessoas: number;
  totalJurisprudencias: number;
  totalAnalisesConsideradas: number;
};

export type ParametrosGerarEstrategiaCaso = {
  dados: DadosContextoEstrategiaCaso;
};

export type ResultadoGerarEstrategiaCaso =
  | {
      ok: true;
      resultado: ResultadoEstrategiaCaso;
      modeloIaUsado: string;
      contextoResumo: ContextoResumoEstrategiaCaso;
    }
  | { ok: false; erro: string };

function montarContextoResumo(dados: DadosContextoEstrategiaCaso): ContextoResumoEstrategiaCaso {
  return {
    totalTeses: dados.teses.length,
    totalEventos: dados.eventos.length,
    totalPessoas: dados.pessoas.length,
    totalJurisprudencias: dados.jurisprudenciasCitadas.length,
    totalAnalisesConsideradas: dados.resumosAnalises.length,
  };
}

/**
 * Função principal do Estrategista Jurídico (ADR 0014, Onda 1). Espelha
 * `lib/advogado-contra/analisar.ts#analisarComoAdvogadoContra`: monta o
 * contexto (`montarContextoEstrategiaCaso`), monta o prompt final
 * (`montarPromptEstrategiaCaso`), chama o Gemini via
 * `gerarRespostaEstruturada` (sem `parteExtra` — não há upload nesta
 * feature) e parseia a resposta de forma fail-closed
 * (`parsearRespostaEstrategiaCaso`, com a lista de ids de teses válidas
 * para rejeitar `teseCasoId` alucinado). NUNCA lança exceção não tratada —
 * todo erro (montagem, chamada de IA, parse) volta como
 * `{ ok: false, erro }` para o caller (Onda 2, `estrategia-actions.ts`)
 * decidir como persistir/exibir.
 *
 * Recebe os dados JÁ BUSCADOS do banco (mesmo shape de
 * `DadosContextoEstrategiaCaso`) — a query real às 6+ tabelas fica fora
 * deste módulo (Onda 2), esta função não faz I/O de leitura de caso, só a
 * chamada de IA.
 */
export async function gerarEstrategiaCaso(
  parametros: ParametrosGerarEstrategiaCaso,
): Promise<ResultadoGerarEstrategiaCaso> {
  try {
    const { dados } = parametros;
    const idsTesesValidos = dados.teses.map((tese) => tese.id);
    // Defesa em profundidade (achado de revisão de segurança): mesmo
    // guardrail fail-closed do teseCasoId, estendido às demais origens que
    // carregam id (evento/análise) — hoje a UI não dereferencia esses ids
    // (só mostra um label genérico por tipo), mas validar aqui evita que a
    // lacuna vire IDOR se uma iteração futura passar a linkar/exibir dado a
    // partir deles sem repetir esta checagem.
    const idsOutrasFontesValidas = {
      eventos: dados.eventos.map((evento) => evento.id),
      analises: dados.resumosAnalises.map((analise) => analise.id),
    };
    const contextoResumo = montarContextoResumo(dados);

    const contexto = montarContextoEstrategiaCaso(dados);
    const promptTexto = montarPromptEstrategiaCaso(contexto);

    const jsonBruto = await gerarRespostaEstruturada({
      promptTexto,
      parteExtra: null,
      systemPrompt: ESTRATEGISTA_CASO_SYSTEM_PROMPT,
      responseSchema: ESTRATEGISTA_CASO_RESPONSE_SCHEMA,
      maxOutputTokens: MAX_OUTPUT_TOKENS_ESTRATEGIA_CASO,
      thinkingBudget: THINKING_BUDGET_ESTRATEGIA_CASO,
      cadeiaModelos: [MODELO_ESTRATEGIA_CASO, MODELO_FALLBACK_QUOTA_ESTRATEGIA_CASO],
      logPrefixo: "[estrategia-caso/gerar]",
    });

    const resultado = parsearRespostaEstrategiaCaso(jsonBruto, idsTesesValidos, idsOutrasFontesValidas);

    if (!resultado) {
      return {
        ok: false,
        erro: "A IA devolveu uma resposta em formato inesperado. Tente novamente.",
      };
    }

    return { ok: true, resultado, modeloIaUsado: MODELO_ESTRATEGIA_CASO, contextoResumo };
  } catch (erro) {
    console.error("[estrategia-caso/gerar] Falha ao gerar estratégia do caso:", erro);
    return { ok: false, erro: mensagemErroIaParaUsuario(erro) };
  }
}
