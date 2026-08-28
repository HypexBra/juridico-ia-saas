import { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Nonce por request (16 bytes aleatórios, `crypto.getRandomValues` — API
 * disponível no runtime Edge do middleware) para permitir uma CSP restritiva
 * (`script-src 'self' 'nonce-...'`, sem `unsafe-inline`) mesmo com os
 * scripts inline que o Next injeta (bootstrap/hidratação) e o `<ThemeScript>`
 * próprio do app (ver `components/theme/theme-script.tsx`).
 */
function gerarNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binario = "";
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return btoa(binario);
}

function construirCsp(nonce: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseOrigin = (() => {
    try {
      return supabaseUrl ? new URL(supabaseUrl).origin : "";
    } catch {
      return "";
    }
  })();

  return [
    `default-src 'self'`,
    // 'self' cobre os chunks JS do Next (carregados via <script src>); o
    // nonce cobre só os scripts inline (bootstrap do Next + ThemeScript).
    `script-src 'self' 'nonce-${nonce}'`,
    // Tailwind/estilos inline via prop `style` seguem em uso em vários
    // componentes — CSS injetado não executa JS, risco muito menor que
    // script-src, então 'unsafe-inline' aqui é aceito (padrão da própria
    // documentação de CSP do Next.js para apps com estilo inline).
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self' data:`,
    `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `form-action 'self'`,
  ].join("; ");
}

export async function middleware(request: NextRequest) {
  const nonce = gerarNonce();
  const csp = construirCsp(nonce);

  // Propaga o nonce como header de REQUEST (para o root layout ler via
  // `headers()` e repassar ao `<ThemeScript nonce={...}>`) antes de entrar
  // em `updateSession` — que já sabe preservar `x-nonce` ao sanear os
  // headers de identidade injetados por sessão.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  const requestComNonce = new NextRequest(request, { headers: requestHeaders });

  const response = await updateSession(requestComNonce);
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
