import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Mensagem de erro compartilhada por todas as features de IA pesada
 * (análise de processo, análise/lote de documento, comparação de documentos,
 * auditoria de peça) quando o gate de concorrência por escritório barra uma
 * nova chamada — achado ALTO repetido em 2 revisões de segurança (Document
 * Intelligence, Auditor de Peças): sem isso, nada impede um único escritório
 * de disparar várias dessas chamadas simultaneamente (múltiplas abas,
 * duplo-clique, script), saturando o pool de chaves de IA compartilhado entre
 * TODOS os tenants da plataforma (`lib/ia/chaves/pool.ts`). O texto deixa
 * claro que o limite é por ESCRITÓRIO, não por feature: disparar análise de
 * processo e auditoria de peça ao mesmo tempo também é barrado.
 */
export const MENSAGEM_PROCESSAMENTO_IA_EM_ANDAMENTO =
  "Já há uma análise de IA em processamento para o seu escritório. Aguarde terminar antes de iniciar outra.";

/**
 * Janela de tolerância para considerar um processamento "em andamento" —
 * mesmo valor/racional já usado em `existeLoteEmProcessamento`
 * (`app/app/documentos/actions.ts`, Fase 3): 10 minutos cobre timeout de
 * rede/loop sequencial sem travar o escritório indefinidamente caso uma linha
 * antiga fique presa (ex.: processo do servidor derrubado no meio da
 * chamada).
 */
const JANELA_PADRAO_MINUTOS = 10;

/**
 * Tabelas que hoje guardam jobs de IA pesada com coluna `status` e valor
 * `"processando"` — uma linha por chamada one-shot estruturada via
 * `lib/ia/chamada-estruturada.ts`. Chat (`app/app/chat/actions.ts`) fica de
 * fora de propósito: já tem defesa própria (limite mensal de mensagens por
 * plano) e seu volume/latência é o de uma conversa normal, não o de um job
 * pesado — gatear chat aqui quebraria a UX de conversa sem reduzir o risco
 * real (que é saturar o pool com chamadas pesadas concorrentes).
 */
const TABELAS_PROCESSAMENTO_IA = [
  "analises_processo",
  "analises_documento",
  "comparacoes_documento",
  "auditorias_peca",
] as const;

/**
 * Verifica se o escritório já tem QUALQUER processamento de IA pesada em
 * andamento (`status = "processando"` criado dentro da janela de tolerância),
 * somando as 4 tabelas que hoje modelam esse tipo de job. Generalização do
 * gate pontual que existia só para o lote de Document Intelligence
 * (`existeLoteEmProcessamento`): o objetivo é impedir qualquer COMBINAÇÃO de
 * features pesadas rodando ao mesmo tempo para o mesmo tenant, não apenas a
 * mesma feature disparada duas vezes.
 *
 * Usa `createClient()` normal (RLS ativo), nunca o client admin — a mesma
 * política de RLS que já restringe cada tabela ao `escritorio_id` do usuário
 * autenticado é suficiente aqui, e usar admin seria escopo maior que o
 * necessário para uma simples contagem.
 *
 * 4 `count` queries em paralelo (`Promise.all`) em vez de 1 query só — as 4
 * tabelas não têm uma view/union já pronta e o volume é baixo o suficiente
 * para não justificar criar uma. Fail-open (retorna `false`) em caso de erro
 * de leitura em qualquer uma das tabelas: mesmo racional já usado em
 * `existeLoteEmProcessamento` — fail-closed em relação ao pool compartilhado
 * seria bloquear a feature inteira por uma falha transitória de rede/infra do
 * Supabase, o que é pior para o usuário do que aceitar o risco residual (o
 * rate-limit real de última linha continua sendo o índice + política do
 * provedor de IA).
 */
export async function existeProcessamentoIaEmAndamento(
  escritorioId: string,
  janelaMinutos: number = JANELA_PADRAO_MINUTOS,
): Promise<boolean> {
  const supabase = await createClient();
  const limite = new Date(Date.now() - janelaMinutos * 60_000).toISOString();

  const resultados = await Promise.all(
    TABELAS_PROCESSAMENTO_IA.map(async (tabela) => {
      const { count, error } = await supabase
        .from(tabela)
        .select("id", { count: "exact", head: true })
        .eq("escritorio_id", escritorioId)
        .eq("status", "processando")
        .gt("criado_em", limite);

      if (error) {
        console.error(
          `[ia/limite-concorrencia/existeProcessamentoIaEmAndamento] Falha ao verificar processamento em "${tabela}":`,
          error,
          { escritorioId, tabela },
        );
        return false;
      }

      return (count ?? 0) > 0;
    }),
  );

  return resultados.some(Boolean);
}
