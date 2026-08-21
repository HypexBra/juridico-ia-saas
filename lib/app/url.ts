import "server-only";

/**
 * URL pública da aplicação, usada em qualquer redirect que precise do
 * domínio absoluto (Stripe success/cancel/return, `redirectTo` de e-mail do
 * Supabase Auth — convite de equipe, redefinição de senha). Sem
 * `NEXT_PUBLIC_APP_URL`, cai para `localhost` — inofensivo para abrir um
 * fluxo, mas quebra o redirect de volta em produção. Loga warning em vez de
 * falhar silenciosamente.
 */
export function obterAppUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    console.warn(
      "[app/url] NEXT_PUBLIC_APP_URL não configurada — usando http://localhost:3000 como fallback. " +
        "Em produção isso quebra redirects pós-checkout/e-mail.",
    );
    return "http://localhost:3000";
  }
  return appUrl.replace(/\/$/, "");
}
