"use client";

import { useEffect, useState } from "react";

const CHAPTERS = [
  { id: "hero", label: "01. Entrada", href: "#" },
  { id: "caso-sistema", label: "02. Contexto", href: "#caso-sistema" },
  { id: "documentos", label: "03. Auditoria", href: "#documentos" },
  { id: "automacao", label: "04. Workflows", href: "#automacao" },
  { id: "precos", label: "05. Execução", href: "#precos" },
];

export function CaseTimelineSpine() {
  const [activeChapter, setActiveChapter] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY + 250;
      const sections = CHAPTERS.map((ch) =>
        ch.href === "#" ? 0 : document.querySelector(ch.href)?.getBoundingClientRect().top ?? 0 + window.scrollY
      );

      for (let i = sections.length - 1; i >= 0; i--) {
        const top = typeof sections[i] === "number" ? (sections[i] as number) : 0;
        if (scrollPos >= top) {
          setActiveChapter(i);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <aside
      aria-label="Navegação pelo fluxo do caso"
      className="fixed bottom-6 right-6 z-40 hidden xl:flex flex-col gap-2 rounded-md border border-silver/20 bg-[#080e1a]/90 p-3 shadow-[0_12px_32px_rgba(0,0,0,0.6)] backdrop-blur-xl transition-all duration-300"
    >
      <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-silver px-1">
        FLUXO DO CASO
      </span>
      <div className="flex flex-col gap-1">
        {CHAPTERS.map((ch, idx) => {
          const isActive = idx === activeChapter;
          return (
            <a
              key={ch.id}
              href={ch.href}
              className={`flex items-center gap-2 rounded px-2 py-1 text-[11px] font-mono transition-all ${
                isActive
                  ? "bg-silver/15 text-ice font-semibold"
                  : "text-muted hover:text-silver-2"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full transition-all ${
                  isActive ? "bg-emerald-400 scale-125" : "bg-silver/30"
                }`}
              />
              <span>{ch.label}</span>
            </a>
          );
        })}
      </div>
    </aside>
  );
}
