"use client";

import Link from "next/link";
import { useState } from "react";
import { IconClose, IconLogoMark, IconMenu } from "./icons";

const NAV_LINKS = [
  { href: "#dossie", label: "O Sistema" },
  { href: "#redline", label: "Auditoria & Redline" },
  { href: "#war-room", label: "Advogado do Contra" },
  { href: "#radar-djen", label: "Radar DJEN" },
  { href: "#precos", label: "Planos" },
  { href: "#seguranca", label: "Segurança" },
];

export function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.07] bg-[#09090b]/85 backdrop-blur-2xl transition-all duration-200">
      {/* Golden progress bar */}
      <div
        aria-hidden
        className="nav-progress absolute inset-x-0 bottom-0 h-[1.5px] origin-left scale-x-0 bg-gradient-to-r from-[#d4af37]/40 via-[#d4af37] to-[#e5c07b]"
      />
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        {/* Brand Seal */}
        <Link
          href="/"
          className="group flex items-center gap-3 text-base tracking-tight text-[#fafaf9]"
          onClick={() => setOpen(false)}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-sm border border-[#d4af37]/40 bg-[#d4af37]/10 text-[#d4af37] transition-all duration-200 group-hover:border-[#d4af37] group-hover:bg-[#d4af37]/20 group-hover:shadow-[0_0_15px_rgba(212,175,55,0.25)]">
            <IconLogoMark className="h-4 w-4" />
          </span>
          <span className="flex items-baseline gap-1.5 font-display text-lg font-bold tracking-tight text-[#fafaf9]">
            Jurídico
            <span className="font-mono text-[10px] font-semibold tracking-widest text-[#d4af37] uppercase bg-[#d4af37]/10 px-1.5 py-0.5 rounded border border-[#d4af37]/30">
              OS
            </span>
          </span>
        </Link>

        {/* Desktop Links */}
        <nav className="hidden items-center gap-8 lg:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-xs font-medium tracking-wide text-[#a1a1aa] transition-colors duration-150 hover:text-[#fafaf9]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden items-center gap-4 lg:flex">
          <Link
            href="/login"
            className="text-xs font-medium tracking-wide text-[#a1a1aa] transition-colors duration-150 hover:text-[#fafaf9]"
          >
            Entrar
          </Link>
          <Link
            href="/cadastro"
            className="group relative inline-flex items-center justify-center overflow-hidden rounded-sm border border-[#d4af37]/60 bg-gradient-to-br from-[#d4af37] to-[#e5c07b] px-4 py-2 text-xs font-bold tracking-wide text-[#09090b] shadow-[0_4px_16px_rgba(212,175,55,0.2)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_22px_rgba(212,175,55,0.35)] active:translate-y-0 active:scale-[0.98]"
          >
            <span>Começar gratuitamente</span>
          </Link>
        </div>

        {/* Mobile Toggle */}
        <button
          type="button"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-sm border border-white/10 text-[#fafaf9] transition-transform duration-150 active:scale-95 active:bg-white/5 lg:hidden"
        >
          {open ? <IconClose className="h-4 w-4" /> : <IconMenu className="h-4 w-4" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {open ? (
        <div className="border-t border-white/10 bg-[#09090b]/98 px-5 pb-6 pt-3 backdrop-blur-2xl lg:hidden">
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-sm px-3 py-2.5 text-sm font-medium text-[#a1a1aa] transition-colors duration-150 hover:bg-white/5 hover:text-[#fafaf9]"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="mt-4 flex flex-col gap-2.5 border-t border-white/10 pt-4">
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="rounded-sm border border-white/15 px-4 py-2.5 text-center text-xs font-medium text-[#fafaf9]"
            >
              Entrar
            </Link>
            <Link
              href="/cadastro"
              onClick={() => setOpen(false)}
              className="rounded-sm bg-gradient-to-br from-[#d4af37] to-[#e5c07b] px-4 py-2.5 text-center text-xs font-bold text-[#09090b]"
            >
              Começar gratuitamente
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
