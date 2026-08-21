"use client";

import Link from "next/link";
import { useState } from "react";
import { IconClose, IconLogoMark, IconMenu } from "./icons";

const NAV_LINKS = [
  { href: "#caso-sistema", label: "O Sistema" },
  { href: "#documentos", label: "Auditoria" },
  { href: "#automacao", label: "Workflows" },
  { href: "#seguranca", label: "Segurança" },
  { href: "#precos", label: "Planos" },
  { href: "#faq", label: "Dúvidas" },
];

export function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-silver/10 bg-navy/80 backdrop-blur-xl transition-all duration-200">
      {/* Subtle top indicator */}
      <div
        aria-hidden
        className="nav-progress absolute inset-x-0 bottom-0 h-[1.5px] origin-left scale-x-0 bg-gradient-to-r from-silver/40 via-silver to-silver/80"
      />
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        {/* Brand identity: bespoke monogram + editorial logotype */}
        <Link
          href="/"
          className="group flex items-center gap-3 font-display text-base tracking-tight text-ice"
          onClick={() => setOpen(false)}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-sm border border-silver/30 bg-silver/5 text-silver transition-colors duration-200 group-hover:border-silver/60 group-hover:bg-silver/10">
            <IconLogoMark className="h-4 w-4" />
          </span>
          <span className="flex items-baseline gap-1.5 font-display text-lg font-bold tracking-tight text-ice">
            Jurídico
            <span className="font-mono text-xs font-semibold tracking-widest text-silver uppercase">
              IA
            </span>
          </span>
        </Link>

        {/* Desktop links */}
        <nav className="hidden items-center gap-7 lg:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-xs font-medium tracking-wide text-muted/90 transition-colors duration-150 hover:text-ice"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Desktop actions */}
        <div className="hidden items-center gap-4 lg:flex">
          <Link
            href="/login"
            className="text-xs font-medium tracking-wide text-muted transition-colors duration-150 hover:text-ice"
          >
            Entrar
          </Link>
          <Link
            href="/cadastro"
            className="group relative inline-flex items-center justify-center overflow-hidden rounded-sm border border-silver/40 bg-silver/10 px-4 py-2 text-xs font-semibold tracking-wide text-ice transition-all duration-200 hover:border-silver hover:bg-silver/20 active:scale-[0.98]"
          >
            <span className="relative z-10">Começar gratuitamente</span>
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-sm border border-silver/20 text-ice transition-transform duration-150 ease-out active:scale-95 active:bg-white/5 lg:hidden"
        >
          {open ? <IconClose className="h-4 w-4" /> : <IconMenu className="h-4 w-4" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open ? (
        <div className="mobile-menu-enter border-t border-silver/10 bg-navy/95 px-5 pb-6 pt-3 backdrop-blur-2xl lg:hidden">
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-sm px-3 py-2.5 text-sm font-medium text-muted transition-colors duration-150 hover:bg-white/5 hover:text-ice active:bg-white/10"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="mt-4 flex flex-col gap-2.5 border-t border-silver/10 pt-4">
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="rounded-sm border border-white/15 px-4 py-2.5 text-center text-xs font-medium text-ice transition-transform duration-150 active:scale-[0.98] active:bg-white/5"
            >
              Entrar
            </Link>
            <Link
              href="/cadastro"
              onClick={() => setOpen(false)}
              className="rounded-sm border border-silver/40 bg-silver/15 px-4 py-2.5 text-center text-xs font-semibold text-ice transition-transform duration-150 active:scale-[0.98]"
            >
              Começar gratuitamente
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
