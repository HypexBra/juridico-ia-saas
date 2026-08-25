import { describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import {
  assinarPayload,
  gerarSecretWebhook,
  montarCabecalhosWebhook,
  verificarAssinaturaWebhook,
} from "./signer";
import {
  atrasoBackoffMs,
  calcularProximaTentativa,
  CAP_BACKOFF_MS,
  entregarWebhook,
  MAX_TENTATIVAS_ENTREGA,
  TIMEOUT_ENTREGA_MS,
  validarUrlWebhook,
} from "./deliver";

// ── signer ───────────────────────────────────────────────────────────────

describe("gerarSecretWebhook", () => {
  it("gera 64 caracteres hex (32 bytes) e nunca repete", () => {
    const a = gerarSecretWebhook();
    const b = gerarSecretWebhook();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(b).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });
});

describe("assinarPayload", () => {
  // Vetor fixo: o hex esperado é calculado AQUI com node:crypto direto —
  // se a implementação divergir do contrato HMAC-SHA256("ts.payload"), o
  // teste quebra mesmo que ambas as partes estejam "consistentes".
  const SECRET = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
  const PAYLOAD = JSON.stringify({ evento: "prazo.criado", id: "abc-123" });
  const TS = 1_691_000_000;

  it("é determinística e bate com HMAC-SHA256 de node:crypto sobre 'ts.payload'", () => {
    const resultado = assinarPayload(SECRET, PAYLOAD, TS);
    const esperado = createHmac("sha256", SECRET).update(`${TS}.${PAYLOAD}`).digest("hex");

    expect(resultado.timestamp).toBe(TS);
    expect(resultado.assinatura).toBe(esperado);
    expect(resultado.assinatura).toMatch(/^[0-9a-f]{64}$/);
  });

  it("muda completamente se payload, segredo ou timestamp mudarem 1 byte/dígito", () => {
    const base = assinarPayload(SECRET, PAYLOAD, TS);
    expect(assinarPayload(SECRET, PAYLOAD + " ", TS).assinatura).not.toBe(base.assinatura);
    expect(assinarPayload(SECRET + "0", PAYLOAD, TS).assinatura).not.toBe(base.assinatura);
    expect(assinarPayload(SECRET, PAYLOAD, TS + 1).assinatura).not.toBe(base.assinatura);
  });
});

describe("montarCabecalhosWebhook", () => {
  const SECRET = "aa".repeat(32);
  const PAYLOAD = '{"ok":true}';
  const TS = 1_712_345_678;

  it("contém t= com o timestamp passado e v1= com o HMAC correto", () => {
    const headers = montarCabecalhosWebhook(SECRET, "caso.criado", PAYLOAD, TS);
    const hmacEsperado = createHmac("sha256", SECRET).update(`${TS}.${PAYLOAD}`).digest("hex");

    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["X-JuridicoIA-Event"]).toBe("caso.criado");
    expect(headers["X-JuridicoIA-Signature"]).toBe(`t=${TS},v1=${hmacEsperado}`);
  });

  it("default do timestamp é agora em SEGUNDOS (não ms)", () => {
    const antes = Math.floor(Date.now() / 1000);
    const headers = montarCabecalhosWebhook(SECRET, "documento.analisado", PAYLOAD);
    const depois = Math.floor(Date.now() / 1000);

    const t = Number(/t=(\d+),/.exec(headers["X-JuridicoIA-Signature"])?.[1]);
    expect(t).toBeGreaterThanOrEqual(antes);
    expect(t).toBeLessThanOrEqual(depois);
  });
});

describe("verificarAssinaturaWebhook (referência do receptor)", () => {
  const SECRET = "bb".repeat(32);
  const PAYLOAD = '{"x":1}';

  it("aceita header válido produzido por montarCabecalhosWebhook", () => {
    const headers = montarCabecalhosWebhook(SECRET, "prazo.atualizado", PAYLOAD, 1_000_000);
    expect(verificarAssinaturaWebhook(SECRET, PAYLOAD, headers["X-JuridicoIA-Signature"])).toBe(true);
  });

  it("rejeita payload adulterado, segredo errado, header malformado e replay fora da janela", () => {
    const headers = montarCabecalhosWebhook(SECRET, "caso.criado", PAYLOAD, 1_000_000);

    expect(verificarAssinaturaWebhook(SECRET, '{"x":2}', headers["X-JuridicoIA-Signature"])).toBe(false);
    expect(verificarAssinaturaWebhook("cc".repeat(32), PAYLOAD, headers["X-JuridicoIA-Signature"])).toBe(false);
    expect(verificarAssinaturaWebhook(SECRET, PAYLOAD, "t=abc,v1=zz")).toBe(false);
    // Janela de 5 min contra timestamp 1_000_000 (décadas atrás) → replay recusado.
    expect(verificarAssinaturaWebhook(SECRET, PAYLOAD, headers["X-JuridicoIA-Signature"], 300)).toBe(false);
  });
});

// ── validarUrlWebhook ────────────────────────────────────────────────────

describe("validarUrlWebhook", () => {
  it("aceita https pública", () => {
    expect(validarUrlWebhook("https://exemplo.com.br/webhooks/juridico")).toEqual({ ok: true, erro: null });
  });

  it("recusa URL malformada e http", () => {
    expect(validarUrlWebhook("nao-e-url").ok).toBe(false);
    expect(validarUrlWebhook("http://exemplo.com/hook").erro).toMatch(/https/i);
  });

  it("recusa localhost e variantes", () => {
    expect(validarUrlWebhook("https://localhost:3000/hook").ok).toBe(false);
    expect(validarUrlWebhook("https://api.localhost/hook").ok).toBe(false);
    expect(validarUrlWebhook("https://servidor.local/hook").ok).toBe(false);
  });

  it("recusa loopback e faixas privadas/link-local", () => {
    for (const host of [
      "127.0.0.1",
      "10.0.0.5",
      "192.168.1.10",
      "172.16.0.1",
      "172.31.255.255",
      "169.254.169.254",
    ]) {
      const resultado = validarUrlWebhook(`https://${host}/hook`);
      expect(resultado.ok, host).toBe(false);
      expect(resultado.erro, host).toMatch(/privad/i);
    }
  });

  it("recusa subdomínio interno com IP privado embutido (estilo nip.io/sslip.io)", () => {
    for (const host of [
      "10.0.0.1.nip.io",
      "app.192.168.0.1.sslip.io",
      "webhook.172.20.3.4.nip.io",
      "meu-servico.127.0.0.1.nip.io",
    ]) {
      expect(validarUrlWebhook(`https://${host}/hook`).ok, host).toBe(false);
    }
  });

  it("não confunde IPs públicos nem números soltos em domínios legítimos", () => {
    // 172.32+ está FORA da faixa privada 172.16-31 — deve passar.
    expect(validarUrlWebhook("https://172.32.0.1.nip.io/hook").ok).toBe(true);
    // Faixas privadas como parte de octetos maiores não são IP: 999.10.0.1 não é IPv4 válido.
    expect(validarUrlWebhook("https://exemplo.com/caminho/10.0.0.1").ok).toBe(true); // IP no PATH, não no host
  });

  it("recusa userinfo embutido (user:senha@host)", () => {
    expect(validarUrlWebhook("https://admin:senha@exemplo.com/hook").ok).toBe(false);
  });
});

// ── backoff ──────────────────────────────────────────────────────────────

describe("calcularProximaTentativa / atrasoBackoffMs", () => {
  const AGORA = 1_000_000_000;

  it("0 tentativas → +60s; 1 → +120s (exponencial base 2, minuto)", () => {
    expect(calcularProximaTentativa(0, AGORA)).toBe(AGORA + 60_000);
    expect(calcularProximaTentativa(1, AGORA)).toBe(AGORA + 120_000);
    expect(calcularProximaTentativa(2, AGORA)).toBe(AGORA + 240_000);
  });

  it("cap de 24h no atraso puro (defensivo para tentativas altas futuras)", () => {
    expect(CAP_BACKOFF_MS).toBe(24 * 60 * 60 * 1000);
    expect(atrasoBackoffMs(30)).toBe(CAP_BACKOFF_MS);
    expect(atrasoBackoffMs(100)).toBe(CAP_BACKOFF_MS);
    // Dentro da janela útil (tentativas < MAX) o cap ainda não é atingido:
    expect(atrasoBackoffMs(MAX_TENTATIVAS_ENTREGA - 1)).toBeLessThan(CAP_BACKOFF_MS);
  });

  it("null após esgotar as 5 tentativas; entradas sujas são normalizadas", () => {
    expect(calcularProximaTentativa(4, AGORA)).not.toBeNull();
    expect(calcularProximaTentativa(5, AGORA)).toBeNull();
    expect(calcularProximaTentativa(50, AGORA)).toBeNull();
    expect(calcularProximaTentativa(-3, AGORA)).toBe(AGORA + 60_000); // clamp para 0
  });
});

// ── entregarWebhook (fetch injetável, sem rede real) ─────────────────────

const ENTRADA_BASE = {
  url: "https://consumidor-exemplo.com/webhook",
  secret: "ab".repeat(32),
  evento: "prazo.criado",
  payload: { teste: true },
};

describe("entregarWebhook", () => {
  it("sucesso 200 → { ok: true, status: 200 }; corpo enviado = string assinada", async () => {
    let capturado: { url: string; init: RequestInit } | null = null;
    const fetchFake = (async (url: string | URL | Request, init?: RequestInit) => {
      capturado = { url: String(url), init: init ?? {} };
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;

    const resultado = await entregarWebhook(ENTRADA_BASE, fetchFake);

    expect(resultado).toEqual({ ok: true, status: 200 });
    const chamada = capturado as { url: string; init: RequestInit } | null;
    expect(chamada?.url).toBe(ENTRADA_BASE.url);

    const corpo = String(chamada?.init.body);
    expect(corpo).toBe(JSON.stringify(ENTRADA_BASE.payload));
    const assinatura = new Headers(chamada?.init.headers).get("X-JuridicoIA-Signature") ?? "";
    expect(assinatura).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
  });

  it("resposta 500 → ok:false com status preservado (para resposta_status na delivery)", async () => {
    const fetchFake = (async () => new Response(null, { status: 500 })) as unknown as typeof fetch;
    await expect(entregarWebhook(ENTRADA_BASE, fetchFake)).resolves.toEqual({ ok: false, status: 500 });
  });

  it("erro de rede → { ok: false, erro }, NUNCA lança", async () => {
    const fetchFake = (async () => {
      throw new Error("getaddrinfo ENOTFOUND consumidor-exemplo.com");
    }) as unknown as typeof fetch;

    await expect(entregarWebhook(ENTRADA_BASE, fetchFake)).resolves.toEqual({
      ok: false,
      erro: expect.stringContaining("ENOTFOUND"),
    });
  });

  it("timeout abortado via AbortController → erro amigável, sem lançar", async () => {
    vi.useFakeTimers();
    try {
      // Fetch falso que respeita o signal: rejeita só quando o controller abortar.
      const fetchLento = ((_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const erro = new Error("The operation was aborted.");
            erro.name = "AbortError";
            reject(erro);
          });
        })) as unknown as typeof fetch;

      const pendente = entregarWebhook(ENTRADA_BASE, fetchLento);
      const verificacao = expect(pendente).resolves.toEqual({
        ok: false,
        erro: expect.stringContaining("Tempo limite excedido"),
      });

      await vi.advanceTimersByTimeAsync(TIMEOUT_ENTREGA_MS + 1);
      await verificacao;
    } finally {
      vi.useRealTimers();
    }
  });

  it("até URL inválida vira resultado (não exceção) — contrato best-effort", async () => {
    const fetchFake = (async () => {
      throw new TypeError("Failed to parse URL");
    }) as unknown as typeof fetch;
    const resultado = await entregarWebhook({ ...ENTRADA_BASE, url: "###" }, fetchFake);
    expect(resultado.ok).toBe(false);
    expect(typeof resultado.erro).toBe("string");
  });
});
