import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { autorizarChamadaCron } from "@/lib/cron/autorizar";
import { FONTES_DIARIAS, NOMES_FONTES_DIARIAS } from "@/lib/rag/fontes-diarias";
import {
  avancarCursorFonte,
  lerCursorFonte,
  lerSaudeFontesRag,
  registrarExecucaoRag,
  type StatusExecucaoRag,
} from "@/lib/rag/execucao";
import { alertarBaseJuridicaDesatualizada } from "@/lib/rag/alerta";

export const dynamic = "force-dynamic";
// Soma do pior caso das fontes registradas (DJEN itera todas as OABs; STJ
// baixa e ingere até 10 arquivos mensais com embedding por chunk). Mesmo teto
// já usado no cron mensal do STJ · exige plano Pro na Vercel.
export const maxDuration = 300;

/**
 * Job diário da base de conhecimento jurídico (item P0.4 do backlog).
 *
 * O que ele é: um ORQUESTRADOR das fontes registradas em
 * `lib/rag/fontes-diarias.ts`. Roda todas na mesma execução, isolando falha
 * por fonte, avançando o cursor de incrementalidade de cada uma e gravando
 * uma linha por fonte em `rag_execucao_log` (migration 0048). No fim, checa a
 * saúde de TODAS as fontes e dispara alerta se alguma passou de
 * `HORAS_SEM_SUCESSO_PARA_ALERTAR` sem sucesso.
 *
 * O que ele NÃO é: uma segunda base vetorial. O conteúdo continua indo para
 * `embeddings_chunks` pelos pipelines já existentes (`lib/djen/sincronizar.ts`,
 * `lib/jurisprudencia/stj.ts`), que já resolvem chunking, embedding,
 * deduplicação e isolamento multi-tenant. Ver o comentário de escopo no topo
 * da migration 0048 e `docs/P0.4-rag-diario-integracao.md`.
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}` (ver `lib/cron/autorizar.ts`).
 * Agendado às 5h UTC em `vercel.json` · horário escolhido porque as
 * publicações do dia anterior em diário oficial já estão consolidadas, então
 * a janela capturada é um dia inteiro fechado em vez de um dia pela metade.
 *
 * Teste manual antes de confiar no automático:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/atualizar-base-juridica
 * e confirmar linhas novas em `rag_execucao_log` com status 'sucesso'.
 */
export async function GET(request: NextRequest) {
  const auth = autorizarChamadaCron(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  const supabase = createAdminClient();
  const iniciouEm = new Date();

  const resultados: Record<
    string,
    {
      status: StatusExecucaoRag;
      documentosNovos: number;
      documentosFalha: number;
      duracaoMs: number;
      erro?: string;
    }
  > = {};

  // Sequencial de propósito, não `Promise.all`: as fontes competem pela mesma
  // cota de embedding do Gemini e pelo mesmo pool de conexões do Postgres.
  // Rodar em paralelo aqui trocaria alguns segundos de wall-clock por 429s do
  // provider no meio da ingestão · e uma fonte que falha por rate limit é
  // pior que uma fonte que termina um minuto depois.
  for (const fonte of FONTES_DIARIAS) {
    const inicioFonte = Date.now();

    // Marco capturado ANTES da busca: é o valor que o cursor recebe se a
    // fonte terminar bem. Ver `avancarCursorFonte`.
    const marcoInicioBusca = new Date();

    try {
      // Fontes com idempotência própria (`ignoraCursor`) não recebem a data
      // do cursor · ver o comentário do campo em `lib/rag/fontes-diarias.ts`.
      const desde = fonte.ignoraCursor ? marcoInicioBusca : await lerCursorFonte(supabase, fonte.nome);

      const resultado = await fonte.executar(supabase, desde);
      const duracaoMs = Date.now() - inicioFonte;

      // Cursor avança só quando a fonte foi até o fim sem exceção. Um
      // 'sucesso_parcial' também avança: as falhas pontuais já estão contadas
      // em `documentos_falha` e a fonte é idempotente, então repetir a janela
      // inteira no dia seguinte só gastaria embedding de novo sem corrigir
      // nada. 'erro' cai no catch e NÃO avança.
      await avancarCursorFonte(supabase, fonte.nome, marcoInicioBusca);

      await registrarExecucaoRag(supabase, {
        fonte: fonte.nome,
        status: resultado.status,
        documentosNovos: resultado.documentosNovos,
        documentosFalha: resultado.documentosFalha,
        duracaoMs,
        mensagemErro: resultado.mensagemErro ?? null,
        detalhes: resultado.detalhes ?? null,
      });

      resultados[fonte.nome] = {
        status: resultado.status,
        documentosNovos: resultado.documentosNovos,
        documentosFalha: resultado.documentosFalha,
        duracaoMs,
        erro: resultado.mensagemErro,
      };
    } catch (erro) {
      const duracaoMs = Date.now() - inicioFonte;
      const mensagem = erro instanceof Error ? erro.message : String(erro);

      // Falha de UMA fonte nunca aborta o loop: as outras ainda podem trazer
      // conteúdo, e é justamente num dia em que uma fonte está fora do ar que
      // as demais importam mais.
      await registrarExecucaoRag(supabase, {
        fonte: fonte.nome,
        status: "erro",
        duracaoMs,
        mensagemErro: mensagem,
      });

      resultados[fonte.nome] = {
        status: "erro",
        documentosNovos: 0,
        documentosFalha: 0,
        duracaoMs,
        erro: mensagem,
      };
    }
  }

  // Alerta baseado no HISTÓRICO, não só nesta execução: uma fonte que falhou
  // agora mas rodou bem há 2h não é incidente; uma que não tem sucesso há
  // dois dias é · mesmo que a execução de hoje tenha reportado 'erro' uma
  // única vez.
  let alerta: Awaited<ReturnType<typeof alertarBaseJuridicaDesatualizada>> | { erro: string };
  try {
    const saude = await lerSaudeFontesRag(supabase, NOMES_FONTES_DIARIAS);
    alerta = await alertarBaseJuridicaDesatualizada(saude);
  } catch (erro) {
    // Não deixa a checagem de saúde derrubar um job que, em si, funcionou.
    alerta = { erro: erro instanceof Error ? erro.message : String(erro) };
  }

  const houveErro = Object.values(resultados).some((r) => r.status === "erro");

  const resumo = {
    ok: !houveErro,
    executadoEm: iniciouEm.toISOString(),
    duracaoTotalMs: Date.now() - iniciouEm.getTime(),
    fontes: resultados,
    alerta,
  };

  console.error(JSON.stringify({ evento: "cron_atualizar_base_juridica", ...resumo }));

  // 200 mesmo com erro parcial: o corpo diz exatamente o que falhou e
  // `rag_execucao_log` guarda o rastro. 500 só quando NENHUMA fonte passou,
  // porque é isso que faz o Vercel Cron marcar a execução como falha e
  // aparecer no painel.
  const todasFalharam = Object.keys(resultados).length > 0 && Object.values(resultados).every((r) => r.status === "erro");

  return NextResponse.json(resumo, { status: todasFalharam ? 500 : 200 });
}
