import Link from "next/link";
import { IconScale } from "./icons";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-silver/10 bg-navy px-5 py-10 sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 text-center sm:flex-row sm:justify-between sm:text-left">
        <Link href="/" className="flex items-center gap-2 font-display text-base font-bold text-ice">
          <IconScale className="h-4 w-4 text-silver" strokeWidth={1.4} />
          Jurídico IA
        </Link>

        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <a href="#funcionalidades" className="text-xs text-muted transition-colors hover:text-silver-2">
            Funcionalidades
          </a>
          <a href="#precos" className="text-xs text-muted transition-colors hover:text-silver-2">
            Planos
          </a>
          <a href="#faq" className="text-xs text-muted transition-colors hover:text-silver-2">
            Perguntas
          </a>
          <Link href="/login" className="text-xs text-muted transition-colors hover:text-silver-2">
            Entrar
          </Link>
        </nav>

        <p className="text-xs text-muted">
          © {year} Jurídico IA. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
