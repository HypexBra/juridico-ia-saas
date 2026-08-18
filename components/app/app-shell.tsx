"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import type { Role } from "@/lib/types";

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
  children,
}: {
  nomeEscritorio: string;
  nomeUsuario: string;
  role: Role;
  children: ReactNode;
}) {
  const [menuAberto, setMenuAberto] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <Sidebar
        nomeEscritorio={nomeEscritorio}
        nomeUsuario={nomeUsuario}
        role={role}
        open={menuAberto}
        onClose={() => setMenuAberto(false)}
      />

      <div className="flex min-h-screen flex-1 flex-col overflow-x-hidden">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-white/10 bg-navy/95 px-4 backdrop-blur-md md:hidden">
          <button
            type="button"
            aria-label="Abrir menu"
            onClick={() => setMenuAberto(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/10 text-ice"
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
            Jurídico<span className="text-gold">IA</span>
          </Link>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 md:px-10 md:py-8">{children}</main>
      </div>
    </div>
  );
}
