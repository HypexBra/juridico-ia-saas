import "server-only";

/**
 * Rate limiter simples em memória, por chave (ex: IP), janela deslizante.
 *
 * LIMITAÇÃO CONHECIDA: o estado vive só na memória do processo Node atual.
 * Em ambiente serverless com múltiplas instâncias (ex: várias lambdas da
 * Vercel atendendo em paralelo, ou reinício/cold start de instância), cada
 * instância tem seu próprio contador — o limite efetivo pode ser N vezes o
 * configurado, N = nº de instâncias ativas, e reinicia a zero a cada cold
 * start. Para uma garantia real, distribuída, isso precisaria de um backend
 * compartilhado (ex: tabela no Postgres com upsert atômico, ou Redis/Upstash).
 * Aceito aqui como mitigação básica contra scraping/enumeração casual — não
 * é proteção contra um atacante com IPs rotativos ou distribuído. Ver
 * comentário de "Enumeração de CPF é um risco aceito" na migration 0008.
 */

type Bucket = { count: number; inicioJanela: number };

const buckets = new Map<string, Bucket>();

// Evita crescimento ilimitado do Map em processos de vida longa: limpa
// entradas expiradas periodicamente, disparado de forma preguiçosa (não há
// setInterval — evita manter o processo vivo/ocupar timers em ambiente
// serverless que já finaliza o processo entre invocações).
function limparExpirados(agora: number, janelaMs: number) {
  if (buckets.size < 500) return;
  for (const [chave, bucket] of buckets) {
    if (agora - bucket.inicioJanela > janelaMs) buckets.delete(chave);
  }
}

/**
 * Verifica e registra uma tentativa para `chave`. Retorna `true` se a
 * tentativa é permitida (dentro do limite), `false` se deve ser bloqueada.
 */
export function verificarRateLimit(
  chave: string,
  opcoes: { maxTentativas: number; janelaMs: number },
): boolean {
  const agora = Date.now();
  limparExpirados(agora, opcoes.janelaMs);

  const bucket = buckets.get(chave);
  if (!bucket || agora - bucket.inicioJanela > opcoes.janelaMs) {
    buckets.set(chave, { count: 1, inicioJanela: agora });
    return true;
  }

  if (bucket.count >= opcoes.maxTentativas) return false;

  bucket.count += 1;
  return true;
}
