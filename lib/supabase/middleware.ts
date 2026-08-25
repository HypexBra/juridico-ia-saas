import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/cadastro",
  "/precos",
  "/auth/callback",
  "/portal/login",
  "/portal/ativar",
  "/portal/consultar",
];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Fail-open controlado (robustez): env ausente (ex.: ambiente local sem
  // .env) ou indisponibilidade pontual do Supabase NÃO podem derrubar rotas
  // públicas com 500. A verificação REAL de autenticação é server-side em
  // cada página/action (getUsuarioAtual), então seguir como anônimo aqui é
  // seguro — rotas protegidas redirecionam lá.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("[middleware] NEXT_PUBLIC_SUPABASE_* ausentes: seguindo sem sessão.");
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response = NextResponse.next({ request });
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  let user = null;
  try {
    const resultado = await supabase.auth.getUser();
    user = resultado.data.user;
  } catch (erro) {
    // Rede/env indisponível: segue como anônimo (ver fail-open acima) —
    // páginas protegidas aplicam a própria verificação server-side.
    console.warn("[middleware] getUser falhou; seguindo sem sessão:", erro instanceof Error ? erro.message : erro);
  }

  const isPublic = PUBLIC_PATHS.some(
    (path) => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith("/_next"),
  );

  if (!user && request.nextUrl.pathname.startsWith("/app") && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Portal do cliente é uma área de autenticação totalmente separada da
  // equipe do escritório: sem sessão, redireciona pro login do PORTAL, nunca
  // pro /login de advogado.
  if (!user && request.nextUrl.pathname.startsWith("/portal") && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/portal/login";
    return NextResponse.redirect(url);
  }

  if (user) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", user.id);
    if (user.email) requestHeaders.set("x-user-email", user.email);
    const finalResponse = NextResponse.next({ request: { headers: requestHeaders } });
    response.cookies.getAll().forEach((cookie) => finalResponse.cookies.set(cookie));
    return finalResponse;
  }

  return response;
}
