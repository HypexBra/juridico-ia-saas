"use client";

import Link from "next/link";
import { useState } from "react";
import { IconClose, IconMenu, IconScale } from "./icons";

const NAV_LINKS = [
  { href: "#funcionalidades", label: "Funcionalidades" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#precos", label: "Planos" },
  { href: "#faq", label: "Perguntas" },
];

export function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-gold/15 bg-navy/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-display text-lg font-bold text-ice"
          onClick={() => setOpen(false)}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-sm border border-gold/40 bg-gold/10 text-gold">
            <IconScale className="h-4 w-4" strokeWidth={1.4} />
          </span>
          Jurídico IA
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted transition-colors hover:text-ice"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="text-sm font-medium text-muted transition-colors hover:text-ice"
          >
            Entrar
          </Link>
          <Link
            href="/cadastro"
            className="rounded-sm bg-gradient-to-br from-gold to-gold-2 px-4 py-2 text-sm font-semibold text-navy transition-opacity hover:opacity-85"
          >
            Começar grátis
          </Link>
        </div>

        <button
          type="button"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-sm border border-gold/20 text-ice md:hidden"
        >
          {open ? <IconClose className="h-5 w-5" /> : <IconMenu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-gold/15 bg-navy px-5 pb-6 pt-2 md:hidden">
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-sm px-2 py-3 text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-ice"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="mt-3 flex flex-col gap-2 border-t border-gold/10 pt-4">
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="rounded-sm border border-white/15 px-4 py-2.5 text-center text-sm font-medium text-ice"
            >
              Entrar
            </Link>
            <Link
              href="/cadastro"
              onClick={() => setOpen(false)}
              className="rounded-sm bg-gradient-to-br from-gold to-gold-2 px-4 py-2.5 text-center text-sm font-semibold text-navy"
            >
              Começar grátis
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
