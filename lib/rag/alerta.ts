import "server-only";

import type { SaudeFonteRag } from "./execucao";
import { HORAS_SEM_SUCESSO_PARA_ALERTAR } from "./execucao";

/**
 * Alerta de "a base jurídica parou de ser atualizada" · último item do
 * critério de aceite do P0.4 ("se o job falhar por mais de 24h seguidas,
 * alguém do time é notificado").
 *
 * Dois canais, nesta ordem, porque nenhum dos dois sozinho é suficiente:
 *
 * 1. `console.error` com um `evento` estável e único
 *    (`rag_base_juridica_desatualizada`). É o que sobrevive quando o próprio
 *    banco está fora e é o gancho para uma regra de alerta no log drain da
 *    Vercel · sempre emitido, nunca condicional.
 * 2. Um webhook HTTP genérico (`RAG_ALERTA_WEBHOOK_URL`): Slack, Discord,
 *    Teams e praticamente qualquer ferramenta de incidente aceitam um POST
 *    JSON com um campo `text`. Foi escolhido em vez de acoplar a rota a um
 *    provedor específico porque o canal real do time é decisão de operação,
 *    não de código: plugar passa a ser preencher uma env var, sem redeploy de
 *    lógica. Sem a env var, o alerta degrada para o canal 1, e isso é dito
 *    explicitamente no retorno (`canalWebhookConfigurado: false`) em vez de
 *    fingir que notificou.
 *
 * NUNCA lança: um alerta que derruba o job de sincronização transformaria
 * "a base está velha" em "a base está velha E o job agora falha", que é
 * estritamente pior.
 */

export type ResultadoAlertaRag = {
  fontesAlertadas: string[];
  canalWebhookConfigurado: boolean;
  webhookEntregue: boolean;
};

/** Timeout curto: o alerta não pode segurar a resposta do cron nem consumir o `maxDuration` da função. */
const TIMEOUT_WEBHOOK_MS = 5_000;

function montarTextoAlerta(fontes: SaudeFonteRag[]): string {
  const linhas = fontes.map((f) => {
    const desde =
      f.horasSemSucesso === null
        ? "nenhuma execução bem-sucedida registrada"
        : `sem sucesso há ${Math.floor(f.horasSemSucesso)}h`;
    const erro = f.ultimaMensagemErro ? ` · último erro: ${f.ultimaMensagemErro}` : "";
    return `• ${f.fonte}: ${desde} (último status: ${f.ultimoStatus ?? "nunca executou"})${erro}`;
  });

  return [
    `[JurídicoIA] Base de conhecimento jurídico desatualizada (limite: ${HORAS_SEM_SUCESSO_PARA_ALERTAR}h).`,
    "As respostas da IA seguem funcionando, mas SEM garantia de jurisprudência/movimentação recente nas fontes abaixo:",
    ...linhas,
    "Verifique /api/cron/atualizar-base-juridica e a tabela rag_execucao_log.",
  ].join("\n");
}

export async function alertarBaseJuridicaDesatualizada(saude: SaudeFonteRag[]): Promise<ResultadoAlertaRag> {
  const emAlerta = saude.filter((f) => f.precisaAlerta);
  const urlWebhook = process.env.RAG_ALERTA_WEBHOOK_URL;

  if (emAlerta.length === 0) {
    return { fontesAlertadas: [], canalWebhookConfigurado: Boolean(urlWebhook), webhookEntregue: false };
  }

  const texto = montarTextoAlerta(emAlerta);

  console.error(
    JSON.stringify({
      evento: "rag_base_juridica_desatualizada",
      limiteHoras: HORAS_SEM_SUCESSO_PARA_ALERTAR,
      fontes: emAlerta.map((f) => ({
        fonte: f.fonte,
        horasSemSucesso: f.horasSemSucesso,
        ultimoStatus: f.ultimoStatus,
        ultimaMensagemErro: f.ultimaMensagemErro,
      })),
    }),
  );

  if (!urlWebhook) {
    return { fontesAlertadas: emAlerta.map((f) => f.fonte), canalWebhookConfigurado: false, webhookEntregue: false };
  }

  let webhookEntregue = false;
  try {
    const resposta = await fetch(urlWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: texto }),
      signal: AbortSignal.timeout(TIMEOUT_WEBHOOK_MS),
    });
    webhookEntregue = resposta.ok;
    if (!resposta.ok) {
      console.error(
        JSON.stringify({
          evento: "rag_alerta_webhook_rejeitado",
          status: resposta.status,
        }),
      );
    }
  } catch (erro) {
    // Nunca logar a URL: webhooks de Slack/Discord carregam o token no path.
    console.error(
      JSON.stringify({
        evento: "rag_alerta_webhook_falhou",
        erro: erro instanceof Error ? erro.message : String(erro),
      }),
    );
  }

  return { fontesAlertadas: emAlerta.map((f) => f.fonte), canalWebhookConfigurado: true, webhookEntregue };
}
