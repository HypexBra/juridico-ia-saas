"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";
import { MobileTabBar } from "./mobile-tab-bar";
import { PageTransition } from "./page-transition";
import { PullToRefresh } from "./pull-to-refresh";
import { Sidebar } from "./sidebar";
import type { Role } from "@/lib/types";

// Command Center (CTRL/CMD+K) só é aberto por atalho/botão: carregamento
// lazy client-side tira o componente do bundle inicial (perf Fase 28).
const CommandCenter = dynamic(() => import("./command-center").then((m) => ({ default: m.CommandCenter })));

const TITULOS: Record<string, string> = {
  "/app/dashboard": "Dashboard",
  "/app/chat": "Chat IA",
  "/app/fichas": "Fichas",
  "/app/prazos": "Prazos",
  "/app/modelos": "Modelos",
  "/app/financeiro": "Financeiro",
  "/app/equipe": "Equipe",
};

function tituloDaRota(pathname: string) {
  const chave = Object.keys(TITULOS).find(
    (rota) => pathname === rota || pathname.startsWith(`${rota}/`),
  );
  return chave ? TITULOS[chave] : "Jurídico IA";
}

export function AppShell({
  nomeEscritorio,
  nomeUsuario,
  role,
  isAdminPlataforma = false,
  children,
}: {
  nomeEscritorio: string;
  nomeUsuario: string;
  role: Role;
  isAdminPlataforma?: boolean;
  children: ReactNode;
}) {
  const [menuAberto, setMenuAberto] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <CommandCenter />
      <Sidebar
        nomeEscritorio={nomeEscritorio}
        nomeUsuario={nomeUsuario}
        role={role}
        isAdminPlataforma={isAdminPlataforma}
        open={menuAberto}
        onClose={() => setMenuAberto(false)}
      />

      <div className="flex min-h-screen flex-1 flex-col overflow-x-hidden">
        <header
          className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-ink/10 bg-navy/95 px-4 backdrop-blur-md md:hidden"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <button
            type="button"
            aria-label="Abrir menu"
            onClick={() => setMenuAberto(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-ink/10 text-ice transition-transform duration-150 ease-out active:scale-90 active:bg-ink/5"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M4 6.5h16" />
              <path d="M4 12h16" />
              <path d="M4 17.5h16" />
            </svg>
          </button>
          <span className="truncate font-display text-sm font-semibold text-ice">
            {tituloDaRota(pathname)}
          </span>
          <Link href="/app/dashboard" className="ml-auto shrink-0 font-display text-sm font-bold text-ice">
            Jurídico<span className="text-silver">IA</span>
          </Link>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 pb-24 sm:px-6 md:px-10 md:py-8 md:pb-8">
          <PullToRefresh>
            <PageTransition>{children}</PageTransition>
          </PullToRefresh>
        </main>
      </div>

      <MobileTabBar onMore={() => setMenuAberto(true)} />
    </div>
  );
}
