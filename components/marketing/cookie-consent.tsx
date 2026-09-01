"use client";

import { useSyncExternalStore } from "react";

/**
 * Aviso de cookies (LGPD) — ver app/privacidade/page.tsx#3 para o detalhe
 * completo do que é usado. Deliberadamente NÃO é um consent manager com
 * toggles por categoria: hoje a plataforma só usa (a) cookie de sessão
 * estritamente necessário (Supabase Auth — login não funciona sem ele) e
 * (b) analytics SEM cookie (Vercel Web Analytics). Não existe cookie
 * opcional pra "aceitar" ou "recusar" de verdade — um banner com botões de
 * escolha fingindo controle sobre algo que não existe seria pior que não ter
 * banner nenhum. Se um cookie não-essencial for adicionado no futuro
 * (ex: publicidade), ESTE componente precisa virar um consent manager de
 * verdade antes de aquele cookie entrar em produção — não depois.
 */
const CHAVE_LOCAL_STORAGE = "juridico-ia-aviso-cookies-visto";

// useSyncExternalStore em vez de useState+useEffect: mesmo padrão de
// components/theme/use-theme.ts, evita a regra `react-hooks/set-state-in-effect`
// e não introduz um flash de hidratação client/server divergente por conta
// própria — `getServerSnapshot` sempre "não visto" (mesmo default do HTML
// vindo do servidor).
const listeners = new Set<() => void>();

function inscrever(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function lerVistoNoCliente(): boolean {
  try {
    return localStorage.getItem(CHAVE_LOCAL_STORAGE) === "1";
  } catch {
    return true; // sem localStorage (modo privado restrito): não insiste em mostrar
  }
}

function lerVistoNoServidor(): boolean {
  return false;
}

export function CookieConsent() {
  const aviso_visto = useSyncExternalStore(inscrever, lerVistoNoCliente, lerVistoNoServidor);

  function dispensar() {
    try {
      localStorage.setItem(CHAVE_LOCAL_STORAGE, "1");
    } catch {
      // Sem persistência local, o aviso reaparece na próxima visita — não é
      // crítico, só um incômodo menor.
    }
    for (const listener of listeners) listener();
  }

  if (aviso_visto) return null;

  return (
    <div
      role="region"
      aria-label="Aviso de cookies"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-ink/10 bg-paper/95 px-5 py-4 backdrop-blur md:px-10"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
        <p className="font-sans-ed text-sm text-ink-2">
          Usamos cookies estritamente necessários para manter sua sessão conectada. Não usamos cookies de
          publicidade ou rastreamento entre sites. Saiba mais na nossa{" "}
          <a href="/privacidade" className="underline hover:text-ink">
            Política de Privacidade e Cookies
          </a>
          .
        </p>
        <button
          type="button"
          onClick={dispensar}
          className="shrink-0 rounded-lg bg-ink px-4 py-2 font-sans-ed text-sm font-medium text-paper transition-opacity hover:opacity-90"
        >
          Entendi
        </button>
      </div>
    </div>
  );
}
