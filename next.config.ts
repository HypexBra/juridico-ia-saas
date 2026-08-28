import type { NextConfig } from "next";
import path from "node:path";

/**
 * Security headers aplicados a toda resposta (paginas, rotas de API,
 * Server Actions) - nenhuma configuracao equivalente existia antes em
 * middleware.ts nem aqui (achado de auditoria de seguranca, item
 * "Headers & Transport" do checklist OWASP Top 10:2025 / Security
 * Misconfiguration).
 *
 * CSP NAO fica aqui: precisa de nonce por request (script-src
 * 'nonce-...', sem unsafe-inline), o que exige middleware, nao esta
 * config estatica. Ver `middleware.ts` para a Content-Security-Policy
 * real, aplicada em toda resposta.
 */
const SECURITY_HEADERS = [
  // HSTS: forca HTTPS por 2 anos, incluindo subdominios, e elegivel a
  // preload. Vercel ja serve tudo em HTTPS; isto fecha o downgrade via
  // link http:// legado.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Clickjacking: nenhuma tela do produto (dados de escritorio/cliente,
  // portal do cliente) deve ser embutivel em iframe de terceiro.
  { key: "X-Frame-Options", value: "DENY" },
  // Bloqueia MIME-sniffing (um upload de documento sendo interpretado
  // como script pelo navegador).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // URL completa (pode conter token de convite/portal) nunca vaza para
  // um terceiro via header Referer em link de saida.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Desliga APIs sensiveis do navegador que o produto nao usa.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
