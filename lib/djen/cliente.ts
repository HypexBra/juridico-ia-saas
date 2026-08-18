import "server-only";

/**
 * Cliente HTTP para a API pública de Comunicações do DJEN (Diário de Justiça
 * Eletrônico Nacional, CNJ) — endpoint confirmado por chamada real:
 * `GET https://comunicaapi.pje.jus.br/api/v1/comunicacao`, sem necessidade de
 * API key. Parâmetros usados: `numeroOab`, `ufOab`, `dataDisponibilizacaoInicio`,
 * `dataDisponibilizacaoFim`, `pagina`, `itensPorPagina`. Resposta:
 * `{ status, message, count, items: [...] }`.
 *
 * A API é *pull* (sem webhook) — quem consome decide de quanto em quanto
 * tempo pergunta "o que há de novo" (ver lib/djen/sincronizar.ts).
 *
 * Ambiente configurável via `DJEN_API_BASE_URL` (default: produção). A
 * documentação oficial do CNJ cita também um ambiente de homologação
 * (`https://hcomunicaapi.cnj.jus.br/api/v1`) — útil para apontar em
 * `DJEN_API_BASE_URL` durante testes manuais sem consultar dados reais.
 */

const DJEN_API_BASE_URL = process.env.DJEN_API_BASE_URL ?? "https://comunicaapi.pje.jus.br/api/v1";

const TIMEOUT_MS = 15_000;
const MAX_TENTATIVAS = 3;
const BACKOFF_BASE_MS = 1_000;

export type ComunicacaoDjen = {
  id: number;
  numero_processo: string;
  numeroprocessocommascara: string;
  siglaTribunal: string;
  tipoComunicacao: string;
  tipoDocumento: string;
  nomeOrgao: string;
  texto: string;
  data_disponibilizacao: string;
  destinatarioadvogados?: Array<{
    advogado: { nome: string; numero_oab: string; uf_oab: string };
  }>;
};

type RespostaDjen = {
  status: string;
  message: string;
  count: number;
  items: ComunicacaoDjen[];
};

export type ParametrosBuscaDjen = {
  numeroOab: string;
  ufOab: string;
  dataInicio: string; // YYYY-MM-DD
  dataFim: string; // YYYY-MM-DD
  pagina?: number;
  itensPorPagina?: number;
};

export type ResultadoBuscaDjen =
  | { ok: true; items: ComunicacaoDjen[]; count: number }
  | { ok: false; error: string };

function aguardar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Busca uma página de comunicações do DJEN para uma OAB. Trata timeout,
 * erro de rede e rate limit (429) com retry exponencial — nunca deixa uma
 * instabilidade do DJEN derrubar o app; em caso de falha definitiva, retorna
 * `{ ok: false, error }` para o chamador decidir o que fazer (ver
 * `sincronizarOab`, que simplesmente pula aquela OAB e tenta de novo no
 * próximo ciclo do cron).
 */
export async function buscarComunicacoesDjen(params: ParametrosBuscaDjen): Promise<ResultadoBuscaDjen> {
  const query = new URLSearchParams({
    numeroOab: params.numeroOab,
    ufOab: params.ufOab,
    dataDisponibilizacaoInicio: params.dataInicio,
    dataDisponibilizacaoFim: params.dataFim,
    pagina: String(params.pagina ?? 1),
    itensPorPagina: String(params.itensPorPagina ?? 100),
  });

  const url = `${DJEN_API_BASE_URL}/comunicacao?${query.toString()}`;

  let ultimoErro = "Erro desconhecido ao consultar o DJEN.";

  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const resposta = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (resposta.status === 429 || resposta.status >= 500) {
        ultimoErro = `DJEN retornou status ${resposta.status}.`;
        if (tentativa < MAX_TENTATIVAS) {
          await aguardar(BACKOFF_BASE_MS * 2 ** (tentativa - 1));
          continue;
        }
        return { ok: false, error: ultimoErro };
      }

      if (!resposta.ok) {
        return { ok: false, error: `DJEN retornou status ${resposta.status} (não recuperável).` };
      }

      const corpo = (await resposta.json()) as RespostaDjen;
      return { ok: true, items: corpo.items ?? [], count: corpo.count ?? 0 };
    } catch (erro) {
      clearTimeout(timeoutId);
      ultimoErro =
        erro instanceof Error && erro.name === "AbortError"
          ? "Timeout ao consultar o DJEN."
          : `Falha de rede ao consultar o DJEN: ${erro instanceof Error ? erro.message : String(erro)}`;
      if (tentativa < MAX_TENTATIVAS) {
        await aguardar(BACKOFF_BASE_MS * 2 ** (tentativa - 1));
        continue;
      }
      return { ok: false, error: ultimoErro };
    }
  }

  return { ok: false, error: ultimoErro };
}

/**
 * Busca TODAS as páginas de comunicações no intervalo, com teto de páginas
 * para nunca fazer uma OAB com histórico enorme monopolizar o cron job (o
 * que sobrar é pego no próximo ciclo, já que a busca é sempre por intervalo
 * de datas + dedupe por id — ver sincronizarOab).
 */
export async function buscarTodasComunicacoesDjen(
  params: Omit<ParametrosBuscaDjen, "pagina">,
  maxPaginas = 10,
): Promise<ResultadoBuscaDjen> {
  const itensPorPagina = params.itensPorPagina ?? 100;
  const acumulado: ComunicacaoDjen[] = [];
  let totalCount = 0;

  for (let pagina = 1; pagina <= maxPaginas; pagina++) {
    const resultado = await buscarComunicacoesDjen({ ...params, pagina, itensPorPagina });
    if (!resultado.ok) {
      // Se já coletamos algo em páginas anteriores, devolve o que temos em
      // vez de descartar tudo por causa de uma falha na última página.
      if (acumulado.length > 0) return { ok: true, items: acumulado, count: totalCount };
      return resultado;
    }

    totalCount = resultado.count;
    acumulado.push(...resultado.items);

    if (resultado.items.length < itensPorPagina) break; // última página
  }

  return { ok: true, items: acumulado, count: totalCount };
}
