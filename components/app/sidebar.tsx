"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { LogoutButton } from "./logout-button";
import type { Role } from "@/lib/types";

const NAV_ITEMS = [
  { href: "/app/dashboard", label: "Dashboard", icon: "grid" as const },
  { href: "/app/chat", label: "Chat IA", icon: "chat" as const },
  { href: "/app/fichas", label: "Fichas", icon: "file" as const },
  { href: "/app/prazos", label: "Prazos", icon: "clock" as const },
  { href: "/app/modelos", label: "Modelos", icon: "layout" as const },
  { href: "/app/financeiro", label: "Financeiro", icon: "chart" as const },
  { href: "/app/relatorios", label: "Relatórios", icon: "report" as const },
  { href: "/app/equipe", label: "Equipe", icon: "users" as const },
  { href: "/app/perfil", label: "Meu perfil", icon: "user" as const },
];

const ICONS: Record<string, React.ReactNode> = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  chat: <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />,
  file: (
    <>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15.5 14" />
    </>
  ),
  layout: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </>
  ),
  chart: (
    <>
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </>
  ),
  users: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  report: (
    <>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="9" y2="17" />
      <line x1="12" y1="11" x2="12" y2="17" />
      <line x1="15" y1="14" x2="15" y2="17" />
    </>
  ),
  user: (
    <>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
};

function NavIcon({ name }: { name: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[name]}
    </svg>
  );
}

const ROLE_LABEL: Record<Role, string> = {
  owner: "Titular",
  admin: "Administrador(a)",
  advogado: "Advogado(a)",
};

export function Sidebar({
  nomeEscritorio,
  nomeUsuario,
  role,
  open,
  onClose,
}: {
  nomeEscritorio: string;
  nomeUsuario: string;
  role: Role;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") onClose();
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [open, onClose]);

  return (
    <>
      {open && (
        <div
          aria-hidden
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] md:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-72 max-w-[85vw] shrink-0 flex-col border-r border-white/10 bg-navy-2 shadow-2xl shadow-black/40 transition-transform duration-200 ease-out md:sticky md:top-0 md:z-0 md:h-screen md:w-64 md:max-w-none md:translate-x-0 md:bg-navy-2/40 md:shadow-none ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-5">
          <div className="min-w-0">
            <Link href="/app/dashboard" className="font-display text-xl font-bold text-ice">
              Jurídico<span className="text-gold">IA</span>
            </Link>
            <p className="mt-2 truncate text-sm font-medium text-ice" title={nomeEscritorio}>
              {nomeEscritorio}
            </p>
            <p className="truncate text-xs text-muted">{nomeUsuario} · {ROLE_LABEL[role]}</p>
          </div>
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 text-muted hover:bg-white/5 hover:text-ice md:hidden"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M5 5l14 14" />
              <path d="M19 5L5 19" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? "bg-gold/15 text-gold-2" : "text-muted hover:bg-white/5 hover:text-ice"
                }`}
              >
                <NavIcon name={item.icon} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-3 py-3">
          <LogoutButton />
        </div>
      </aside>
    </>
  );
}
