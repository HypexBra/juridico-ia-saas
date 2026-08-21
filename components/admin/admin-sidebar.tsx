"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { LogoutButton } from "@/components/app/logout-button";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/usuarios", label: "Usuários" },
  { href: "/admin/conversas", label: "Conversas" },
  { href: "/admin/administradores", label: "Administradores" },
  { href: "/admin/ia-chaves", label: "Chaves de IA" },
  { href: "/admin/logs", label: "Logs" },
  { href: "/admin/configuracoes", label: "Configurações" },
];

export function AdminSidebar({
  nomeAdmin,
  open,
  onClose,
}: {
  nomeAdmin: string;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

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
        className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-72 max-w-[85vw] shrink-0 flex-col border-r border-amber-500/20 bg-navy-2 shadow-2xl shadow-black/40 transition-transform duration-200 ease-out md:sticky md:top-0 md:z-0 md:h-screen md:w-64 md:max-w-none md:translate-x-0 md:bg-navy-2/40 md:shadow-none ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-white/10 px-5 py-5">
          <Link href="/app/dashboard" className="font-display text-xl font-bold text-ice">
            Jurídico<span className="text-silver">IA</span>
          </Link>
          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-amber-300">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" />
            </svg>
            Administrador
          </p>
          <p className="mt-1 truncate text-sm text-ice" title={nomeAdmin}>
            {nomeAdmin}
          </p>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? "bg-amber-500/15 text-amber-200" : "text-muted hover:bg-white/5 hover:text-ice"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-3 py-3">
          <Link href="/app/dashboard" className="mb-1 block rounded-lg px-3 py-2 text-sm text-muted hover:bg-white/5 hover:text-ice">
            ← Voltar ao app
          </Link>
          <LogoutButton />
        </div>
      </aside>
    </>
  );
}
