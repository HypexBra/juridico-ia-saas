"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/app/dashboard", label: "Início", icon: "grid" as const },
  { href: "/app/chat", label: "Chat", icon: "chat" as const },
  { href: "/app/prazos", label: "Prazos", icon: "clock" as const },
  { href: "/app/financeiro", label: "Financeiro", icon: "chart" as const },
];

const TAB_ICONS: Record<string, React.ReactNode> = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  chat: <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15.5 14" />
    </>
  ),
  chart: (
    <>
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </>
  ),
};

function TabIcon({ name }: { name: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {TAB_ICONS[name]}
    </svg>
  );
}

/**
 * Tab bar inferior — leitura de app nativo mobile, substitui a dependência
 * exclusiva do hambúrguer. Cobre os 4 destinos de maior frequência de uso;
 * "Mais" abre a mesma gaveta (`Sidebar`) com o restante do menu.
 */
export function MobileTabBar({ onMore }: { onMore: () => void }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-white/10 bg-navy-2/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {TABS.map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={`relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10.5px] font-medium transition-colors duration-150 ease-out active:scale-95 active:bg-white/[.06] ${
              isActive ? "text-gold-2" : "text-muted"
            }`}
          >
            {isActive && (
              <span aria-hidden className="absolute top-0 h-0.5 w-9 rounded-full bg-gradient-to-r from-gold to-gold-2" />
            )}
            <TabIcon name={tab.icon} />
            {tab.label}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={onMore}
        aria-label="Mais opções"
        className="relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10.5px] font-medium text-muted transition-colors duration-150 ease-out active:scale-95 active:bg-white/[.06]"
      >
        <TabIcon name="more" />
        Mais
      </button>
    </nav>
  );
}
