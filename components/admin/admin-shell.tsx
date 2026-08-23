"use client";

import Link from "next/link";
import { useState } from "react";
import type { ReactNode } from "react";
import { AdminSidebar } from "./admin-sidebar";

export function AdminShell({ nomeAdmin, children }: { nomeAdmin: string; children: ReactNode }) {
  const [menuAberto, setMenuAberto] = useState(false);

  return (
    <div className="flex min-h-screen">
      <AdminSidebar nomeAdmin={nomeAdmin} open={menuAberto} onClose={() => setMenuAberto(false)} />

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
          <span className="truncate font-display text-sm font-semibold text-amber-700">Painel Admin</span>
          <Link href="/app/dashboard" className="ml-auto shrink-0 font-display text-sm font-bold text-ice">
            Jurídico<span className="text-silver">IA</span>
          </Link>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 pb-10 sm:px-6 md:px-10 md:py-8">{children}</main>
      </div>
    </div>
  );
}
