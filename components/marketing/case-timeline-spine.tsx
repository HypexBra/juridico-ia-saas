"use client";

import { useEffect, useState } from "react";

const CHAPTERS = [
  { id: "hero", label: "01. Entrada", href: "#" },
  { id: "dossie", label: "02. Dossiê Vivo", href: "#dossie" },
  { id: "redline", label: "03. Redline", href: "#redline" },
  { id: "war-room", label: "04. War Room", href: "#war-room" },
  { id: "radar-djen", label: "05. Radar DJEN", href: "#radar-djen" },
  { id: "precos", label: "06. Planos", href: "#precos" },
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
      className="fixed bottom-6 right-6 z-40 hidden xl:flex flex-col gap-2 rounded-xl border border-white/[0.1] bg-[#121216]/90 p-3.5 shadow-[0_16px_40px_rgba(0,0,0,0.8)] backdrop-blur-2xl transition-all duration-300"
    >
      <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-[#d4af37] px-1">
        FLUXO DO CASO
      </span>
      <div className="flex flex-col gap-1">
        {CHAPTERS.map((ch, idx) => {
          const isActive = idx === activeChapter;
          return (
            <a
              key={ch.id}
              href={ch.href}
              className={`flex items-center gap-2 rounded px-2.5 py-1 text-[11px] font-mono transition-all ${
                isActive
                  ? "bg-[#d4af37]/15 text-[#fafaf9] font-semibold border border-[#d4af37]/30"
                  : "text-[#a1a1aa] hover:text-[#d4af37]"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full transition-all ${
                  isActive ? "bg-[#d4af37] scale-125" : "bg-white/20"
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
