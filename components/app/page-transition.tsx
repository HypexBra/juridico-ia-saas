"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Transição de tela leve entre rotas do app interno — remonta o subtree por
 * `key={pathname}` e deixa uma animação CSS (`app-page-enter`, definida em
 * `globals.css`) fazer o fade/slide-up de 260ms. Só `opacity`/`transform`
 * (compositor, sem layout thrashing) e já respeita `prefers-reduced-motion`
 * via a regra global que zera durações de animação.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="app-page-enter min-w-0">
      {children}
    </div>
  );
}
