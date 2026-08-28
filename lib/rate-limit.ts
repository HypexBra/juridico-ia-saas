import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Rate limiter distribuído (Upstash Redis) com fallback em memória.
 *
 * Em produção serverless (Vercel), múltiplas instâncias/cold starts fazem um
 * limiter puramente em memória perder eficácia — cada instância tem seu
 * próprio contador. Com `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`
 * configurados, o limite é real e compartilhado entre todas as instâncias.
 * Sem essas envs (dev local, ou antes de provisionar o Upstash), cai no
 * fallback em memória — mitigação básica, não uma garantia distribuída,
 * mas nunca quebra a rota por falta de infra.
 */

type Bucket = { count: number; inicioJanela: number };

const buckets = new Map<string, Bucket>();

function limparExpirados(agora: number, janelaMs: number) {
  if (buckets.size < 500) return;
  for (const [chave, bucket] of buckets) {
    if (agora - bucket.inicioJanela > janelaMs) buckets.delete(chave);
  }
}

function verificarRateLimitMemoria(
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

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

// Uma instância de `Ratelimit` por combinação (maxTentativas, janelaMs) —
// a lib exige o limite fixado na criação, e os call sites deste módulo usam
// um punhado de combinações fixas (login, consulta pública, API v1).
const limiters = new Map<string, Ratelimit>();

function obterLimiter(maxTentativas: number, janelaMs: number): Ratelimit {
  const chaveConfig = `${maxTentativas}:${janelaMs}`;
  let limiter = limiters.get(chaveConfig);
  if (!limiter) {
    const janelaSegundos = Math.max(1, Math.round(janelaMs / 1000));
    limiter = new Ratelimit({
      redis: redis!,
      limiter: Ratelimit.slidingWindow(maxTentativas, `${janelaSegundos} s`),
      analytics: false,
      prefix: "ratelimit",
    });
    limiters.set(chaveConfig, limiter);
  }
  return limiter;
}

/**
 * Verifica e registra uma tentativa para `chave`. Retorna `true` se a
 * tentativa é permitida (dentro do limite), `false` se deve ser bloqueada.
 */
export async function verificarRateLimit(
  chave: string,
  opcoes: { maxTentativas: number; janelaMs: number },
): Promise<boolean> {
  if (redis) {
    try {
      const limiter = obterLimiter(opcoes.maxTentativas, opcoes.janelaMs);
      const { success } = await limiter.limit(chave);
      return success;
    } catch (erro) {
      // Upstash indisponível: cai no fallback em memória em vez de derrubar
      // a rota (mesma filosofia de fail-open segura usada no middleware).
      console.warn(
        "[rate-limit] Upstash falhou; usando fallback em memória:",
        erro instanceof Error ? erro.message : erro,
      );
      return verificarRateLimitMemoria(chave, opcoes);
    }
  }
  return verificarRateLimitMemoria(chave, opcoes);
}
