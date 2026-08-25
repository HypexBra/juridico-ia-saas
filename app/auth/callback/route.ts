import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { obterAppUrl } from "@/lib/app/url";

/**
 * Rota de callback do Supabase Auth (referenciada em `PUBLIC_PATHS` de
 * `lib/supabase/middleware.ts` desde o início do projeto, mas nunca
 * implementada até agora — gap real: nenhum link de e-mail do Supabase
 * (convite de equipe, redefinição de senha) tinha pra onde voltar depois de
 * trocar o `code` por sessão).
 *
 * Fluxo PKCE padrão do `@supabase/ssr`: o link do e-mail aponta para cá com
 * `?code=...`, trocamos por uma sessão real (grava os cookies via
 * `createClient()`) e redirecionamos para `next` (default: dashboard).
 *
 * `next` é validado por ALLOWLIST exata (`DESTINOS_PERMITIDOS`), não por
 * blocklist de prefixo — achado de revisão de segurança: um blocklist
 * ingênuo (`startsWith("/") && !startsWith("//")`) é insuficiente porque o
 * parser de URL do WHATWG normaliza `\` para `/` em schemes especiais
 * (http/https) ANTES de resolver a URL relativa — `new URL("/\\evil.com",
 * "https://site.com")` resolve para `https://evil.com/`, um open redirect
 * pós-autenticação (o `code` já foi trocado por sessão real nesse ponto).
 * Como este projeto só gera 2 valores possíveis de `next` (o próprio
 * código, nunca input de usuário), allowlist é estritamente mais seguro e
 * não perde nenhuma funcionalidade real.
 */
const DESTINOS_PERMITIDOS = new Set(["/app/dashboard", "/auth/definir-senha"]);

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");
  const next = nextParam && DESTINOS_PERMITIDOS.has(nextParam) ? nextParam : "/app/dashboard";

  const appUrl = obterAppUrl();
  const destino = new URL(next, appUrl || origin);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth/callback] Falha ao trocar code por sessão:", error);
      return NextResponse.redirect(new URL("/login?erro=link_invalido", appUrl || origin));
    }
  }

  return NextResponse.redirect(destino);
}
