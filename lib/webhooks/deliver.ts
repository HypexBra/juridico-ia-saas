/**
 * Entrega de webhooks de saída (Fase 22) — eventos, validação de URL
 * (SSRF básico), POST assinado com timeout e política de retry.
 *
 * Este módulo é puro em relação a banco/Next: recebe tudo por parâmetro e
 * aceita um `fetchImpl` injetável, o que permite testar rede/timeout sem
 * tocar na internet (ver signer.test.ts).
 */
import { montarCabecalhosWebhook } from "./signer";

/** Catálogo canônico de eventos emitidos pelo produto. */
export const EVENTOS_WEBHOOK = [
  "prazo.criado",
  "prazo.atualizado",
  "caso.criado",
  "caso.atualizado",
  "documento.analisado",
] as const;

export type EventoWebhook = (typeof EVENTOS_WEBHOOK)[number];

/**
 * Valida uma URL de endpoint para cadastro/exibição.
 *
 * SSRF BÁSICO (documentado): bloqueia esquemas não-https e hostnames que
 * apontem para loopback/rede privada — incluindo IPs privados EMBUTIDOS em
 * subdomínios estilo nip.io/sslip.io (`https://10.0.0.1.nip.io/hook` é
 * recusado porque o hostname contém um IPv4 privado). LIMITAÇÃO conhecida:
 * isto é filtragem sintática de hostname — NÃO resolve DNS. Um domínio
 * público que resolva para IP privado em runtime (DNS rebinding) escaparia
 * desta checagem; a mitigação definitiva exige resolução+checagem no momento
 * da entrega dentro do ambiente de execução (risco residual registrado).
 *
 * @returns `{ ok: true }` ou `{ ok: false, erro }` com mensagem pt-BR pronta para UI.
 */
export type ResultadoValidacaoUrl = { ok: boolean; erro: string | null };

const IPV4_NO_HOSTNAME = /\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/g;

function ehIpv4Privado(ip: string): boolean {
  const partes = ip.split(".").map(Number);
  if (partes.length !== 4 || partes.some((p) => Number.isNaN(p))) return false;
  const [a, b] = partes as [number, number, number, number];
  if (a === 127) return true; // loopback 127.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 169 && b === 254) return true; // link-local 169.254.0.0/16 (inclui metadados cloud 169.254.169.254)
  return false;
}

function hostnameEhInterno(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;

  // Qualquer IPv4 presente no hostname (host inteiro OU embutido em
  // subdomínio tipo `10.0.0.1.nip.io`) cai na checagem de faixa privada.
  for (const match of host.matchAll(IPV4_NO_HOSTNAME)) {
    if (ehIpv4Privado(match[0])) return true;
  }
  return false;
}

export function validarUrlWebhook(url: string): ResultadoValidacaoUrl {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, erro: "URL inválida — informe um endereço completo, ex: https://exemplo.com/webhook." };
  }

  // new URL aceita espaços/controles em alguns casos — rejeita se a
  // serialização não bater com o input essencial ou se houver userinfo.
  if (parsed.username || parsed.password) {
    return { ok: false, erro: "URL não pode conter usuário/senha embutidos." };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, erro: "Somente URLs https:// são aceitas — o webhook carrega dados do processo." };
  }
  if (!parsed.hostname) {
    return { ok: false, erro: "URL sem host válido." };
  }
  if (hostnameEhInterno(parsed.hostname)) {
    return { ok: false, erro: "Endereços internos/privados (localhost ou redes privadas) não são permitidos." };
  }

  return { ok: true, erro: null };
}

// ── Entrega ──────────────────────────────────────────────────────────────

export const TIMEOUT_ENTREGA_MS = 10_000;

export type ResultadoEntrega = {
  /** true somente em resposta HTTP 2xx. */
  ok: boolean;
  status?: number;
  erro?: string;
};

export type EntradaEntregaWebhook = {
  url: string;
  secret: string;
  evento: string;
  /** Payload JSON-serializável; é serializado UMA vez e a MESMA string é assinada e enviada. */
  payload: unknown;
};

/**
 * Executa UMA tentativa de entrega: POST https com headers assinados
 * (`lib/webhooks/signer.ts#montarCabecalhosWebhook`) e timeout rígido de
 * 10s via AbortController.
 *
 * CONTRATO: NUNCA lança. Qualquer falha — URL inválida, rede, DNS, abort
 * por timeout — vira `{ ok: false, erro }`. O chamador (emitir.ts) apenas
 * persiste o resultado na delivery.
 */
export async function entregarWebhook(
  entrada: EntradaEntregaWebhook,
  fetchImpl: typeof fetch = fetch,
): Promise<ResultadoEntrega> {
  // Serializa UMA vez: a string assinada tem de ser byte a byte a enviada.
  const corpo = JSON.stringify(entrada.payload);
  const cabecalhos = montarCabecalhosWebhook(
    entrada.secret,
    entrada.evento,
    corpo,
    Math.floor(Date.now() / 1000),
  );

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_ENTREGA_MS);

  try {
    const resposta = await fetchImpl(entrada.url, {
      method: "POST",
      headers: cabecalhos,
      body: corpo,
      signal: controller.signal,
    });
    return { ok: resposta.ok, status: resposta.status };
  } catch (erro: unknown) {
    if (erro instanceof Error && erro.name === "AbortError") {
      return { ok: false, erro: `Tempo limite excedido (${TIMEOUT_ENTREGA_MS / 1000}s).` };
    }
    return { ok: false, erro: erro instanceof Error ? erro.message : String(erro) };
  } finally {
    clearTimeout(timer);
  }
}

// ── Retry (backoff exponencial puro) ─────────────────────────────────────

/** Máximo de tentativas por delivery antes de desistir (null no scheduler). */
export const MAX_TENTATIVAS_ENTREGA = 5;

/** Teto do intervalo entre tentativas: 24 horas. */
export const CAP_BACKOFF_MS = 24 * 60 * 60 * 1000;

/**
 * Puro: atraso em ms antes da próxima tentativa — min(2^tentativas · 60s, 24h).
 * Sem corte de limite de tentativas (esse corte vive em
 * `calcularProximaTentativa`), o que mantém o cap de 24h testável isolado.
 */
export function atrasoBackoffMs(tentativas: number): number {
  const n = Math.max(0, Math.trunc(tentativas));
  return Math.min(2 ** n * 60_000, CAP_BACKOFF_MS);
}

/**
 * Puro e determinístico (testável sem relógio — passe `agora` fixo):
 * timestamp (ms) da próxima tentativa ou `null` quando a delivery esgotou
 * as {@link MAX_TENTATIVAS_ENTREGA} tentativas.
 *
 * Consumido hoje pela UI/log para EXIBIR quando haverá nova tentativa; o
 * agendamento automático será feito por um cron futuro que lê as deliveries
 * `falha` com `tentativas < MAX` e reexecuta `entregarWebhook`.
 */
export function calcularProximaTentativa(tentativas: number, agora: number = Date.now()): number | null {
  if (Math.max(0, Math.trunc(tentativas)) >= MAX_TENTATIVAS_ENTREGA) return null;
  return agora + atrasoBackoffMs(tentativas);
}
