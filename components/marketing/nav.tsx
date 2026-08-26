"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { IconClose, IconMenu } from "./icons";

/* Nav editorial "papel-e-tinta": transparente sobre o papel e, depois de
   24px de scroll, ganha fundo translúcido + hairline. Sem libs novas:
   listener de scroll passivo com coalescência via requestAnimationFrame.
   Âncoras seguem a gramática da landing v3 (#produto/#como-funciona/
   #recursos/#planos) e a rota real de cadastro é /cadastro. */

const NAV_LINKS = [
  { href: "#produto", label: "Produto" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#recursos", label: "Recursos" },
  { href: "#planos", label: "Planos" },
  { href: "#contato", label: "Contato" },
] as const;

const SIGNUP_HREF = "/cadastro";
const LOGIN_HREF = "/login";
const SCROLL_THRESHOLD_PX = 24;

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  // Estado "rolado": rAF coalesce (no máximo 1 setState por frame) e checagem
  // inicial dentro do próprio frame — cobre carregamento já rolado sem
  // chamar setState de forma síncrona no corpo do efeito.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setScrolled(window.scrollY > SCROLL_THRESHOLD_PX);
    };
    const scheduleUpdate = () => {
      if (frame === 0) frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, []);

  // Menu mobile aberto: fecha no Escape e trava o scroll do documento
  // por trás do painel (restaurando o valor anterior no cleanup).
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.documentElement.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color,backdrop-filter] duration-300 ease-out ${
        scrolled
          ? "border-ink/10 bg-paper/90 backdrop-blur-sm"
          : "border-transparent bg-transparent"
      }`}
    >
      {/* Skip-link: invisível até receber foco via teclado. */}
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-[60] focus:border focus:border-ink/20 focus:bg-paper focus:px-4 focus:py-2 focus:font-sans-ed focus:text-sm focus:text-ink"
      >
        Pular para o conteúdo
      </a>

      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 md:px-10">
        {/* Logo estritamente tipográfico — sem imagem, sem ícone. */}
        <Link
          href="/"
          className="font-serif-ed text-lg font-semibold tracking-tight text-ink"
          onClick={() => setOpen(false)}
        >
          Jurídico IA
        </Link>

        <nav aria-label="Navegação principal" className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="font-sans-ed text-sm text-ink-2 transition-colors hover:text-ink"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Par de ações: "Entrar" (link textual) + CTA primário. Quem já tem
            conta não precisa passar pelo cadastro para logar. */}
        <div className="hidden items-center gap-5 md:flex">
          <ThemeToggle className="flex h-9 w-9 items-center justify-center rounded-none border border-ink/15 text-ink-2 transition-colors hover:border-ink/30 hover:text-ink" />
          <Link
            href={LOGIN_HREF}
            className="font-sans-ed text-sm font-medium text-ink-2 transition-colors hover:text-ink"
          >
            Entrar
          </Link>
          <Link
            href={SIGNUP_HREF}
            className="rounded-none bg-ink px-4 py-2 font-sans-ed text-sm font-medium text-paper transition-colors hover:bg-ink/90"
          >
            Começar gratuitamente
          </Link>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle className="flex h-10 w-10 items-center justify-center rounded-none border border-ink/15 text-ink transition-colors hover:border-ink/30" />
          <button
            type="button"
            aria-expanded={open}
            aria-controls="menu-mobile"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            onClick={() => setOpen((value) => !value)}
            className="flex h-10 w-10 items-center justify-center rounded-none border border-ink/15 text-ink transition-colors hover:border-ink/30"
          >
            {open ? <IconClose className="h-5 w-5" /> : <IconMenu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Painel mobile: página inteira em papel sob a barra fixa (h-16).
          Links grandes, fecha ao navegar ou no Escape. */}
      {open ? (
        <div id="menu-mobile" className="fixed inset-x-0 bottom-0 top-16 z-40 bg-paper md:hidden">
          <nav aria-label="Menu móvel" className="flex h-full flex-col px-5 pb-10 pt-2">
            <ul>
              {NAV_LINKS.map((link) => (
                <li key={link.href} className="border-b border-ink/10">
                  <a
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="block py-4 font-serif-ed text-2xl tracking-tight text-ink"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>

            <Link
              href={LOGIN_HREF}
              onClick={() => setOpen(false)}
              className="mt-auto border border-ink/15 py-3 text-center font-sans-ed text-sm font-medium text-ink transition-colors hover:border-ink/30"
            >
              Entrar
            </Link>
            <Link
              href={SIGNUP_HREF}
              onClick={() => setOpen(false)}
              className="mt-2 rounded-none bg-ink px-4 py-3 text-center font-sans-ed text-sm font-medium text-paper transition-colors hover:bg-ink/90"
            >
              Começar gratuitamente
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
