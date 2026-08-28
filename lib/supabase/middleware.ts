import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/login/recuperar",
  "/cadastro",
  "/auth/callback",
  "/portal/login",
  "/portal/recuperar",
  "/portal/ativar",
  "/portal/consultar",
];

/**
 * Headers de identidade que ESTE middleware injeta para o fast path de
 * `lib/app/current-user.ts` / `lib/app/current-client-portal.ts`. Como são
 * lidos server-side como se fossem confiáveis, um header de MESMO NOME vindo
 * do cliente jamais pode sobreviver até a rota: `new Headers(request.headers)`
 * copia o que veio na requisição, e no caminho "sem sessão" a requisição
 * seguia adiante intacta · bastava um `curl -H "x-user-id: <uuid>"` para
 * `getUsuarioAtual()` resolver uma identidade que o Supabase Auth nunca
 * emitiu. Hoje a RLS ainda barra a leitura (as policies resolvem
 * `auth.uid()` pelo JWT do cookie, não pelo header), mas isso é sorte de
 * defesa em profundidade, não desenho: qualquer rota futura que troque o
 * client de sessão por `createAdminClient()` depois de identificar o usuário
 * por `getUsuarioAtual()` viraria bypass de autenticação direto.
 * Por isso: sempre remover o header do cliente ANTES de qualquer coisa, e só
 * o middleware ter o direito de escrevê-lo.
 */
const HEADERS_IDENTIDADE_INJETADOS = ["x-user-id", "x-user-email"] as const;

function semHeadersDeIdentidadeDoCliente(request: NextRequest): Headers {
  const headers = new Headers(request.headers);
  for (const nome of HEADERS_IDENTIDADE_INJETADOS) headers.delete(nome);
  return headers;
}

export async function updateSession(request: NextRequest) {
  // Qualquer x-user-id/x-user-email que o cliente tenha mandado é descartado
  // aqui e nunca chega à rota. Todo `NextResponse.next` abaixo (inclusive os
  // caminhos de fail-open) parte desta versão saneada, nunca de `request` cru.
  // `x-nonce` (injetado por middleware.ts antes de chamar esta função) é
  // preservado — não está na lista de headers de identidade descartados.
  let response = NextResponse.next({ request: { headers: semHeadersDeIdentidadeDoCliente(request) } });

  // Fail-open controlado (robustez): env ausente (ex.: ambiente local sem
  // .env) ou indisponibilidade pontual do Supabase NÃO podem derrubar rotas
  // públicas com 500. A verificação REAL de autenticação é server-side em
  // cada página/action (getUsuarioAtual), então seguir como anônimo aqui é
  // seguro · rotas protegidas redirecionam lá.
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
          // Recalcula a partir do `request` já mutado (para o cookie
          // renovado propagar), passando de novo pelo saneamento.
          response = NextResponse.next({ request: { headers: semHeadersDeIdentidadeDoCliente(request) } });
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
    // Rede/env indisponível: segue como anônimo (ver fail-open acima) ·
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
    const requestHeaders = semHeadersDeIdentidadeDoCliente(request);
    requestHeaders.set("x-user-id", user.id);
    if (user.email) requestHeaders.set("x-user-email", user.email);
    const finalResponse = NextResponse.next({ request: { headers: requestHeaders } });
    response.cookies.getAll().forEach((cookie) => finalResponse.cookies.set(cookie));
    return finalResponse;
  }

  return response;
}
