import Link from "next/link";

/* Footer minimalista da spec v3: logo serif, três colunas de links e uma
   linha final mono. Links âncora consistentes com o nav (#como-funciona,
   #recursos, #planos). Termos/Privacidade apontam para rotas reais
   (app/termos, app/privacidade: LGPD exige política publicada e acessível,
   não só linkada em texto); Exclusão de dados é página própria em
   app/exclusao-de-dados. */

const PRODUCT_LINKS = [
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#recursos", label: "Recursos" },
  { href: "#planos", label: "Planos" },
  { href: "/blog", label: "Blog" },
] as const;

const LEGAL_LINKS = [
  { href: "/termos", label: "Termos" },
  { href: "/privacidade", label: "Privacidade" },
  { href: "/exclusao-de-dados", label: "Exclusão de dados" },
] as const;

export function Footer() {
  return (
    <footer className="border-t border-ink/10 bg-paper">
      <div className="mx-auto max-w-6xl px-5 py-14 md:px-10 md:py-16">
        <div className="flex flex-col gap-12 md:flex-row md:items-start md:justify-between">
          <Link
            href="/"
            className="self-start font-serif-ed text-xl font-semibold tracking-tight text-ink"
          >
            Jurídico IA
          </Link>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 md:gap-20">
            <nav aria-label="Produto">
              <p className="font-mono-ed text-[11px] uppercase tracking-[0.2em] text-ink-3">
                Produto
              </p>
              <ul className="mt-4 space-y-2.5">
                {PRODUCT_LINKS.map((link) =>
                  link.href.startsWith("/") ? (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="font-sans-ed text-sm text-ink-2 transition-colors hover:text-ink"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ) : (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="font-sans-ed text-sm text-ink-2 transition-colors hover:text-ink"
                      >
                        {link.label}
                      </a>
                    </li>
                  ),
                )}
              </ul>
            </nav>

            <nav aria-label="Legal">
              <p className="font-mono-ed text-[11px] uppercase tracking-[0.2em] text-ink-3">
                Legal
              </p>
              <ul className="mt-4 space-y-2.5">
                {LEGAL_LINKS.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="font-sans-ed text-sm text-ink-2 transition-colors hover:text-ink"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <nav aria-label="Contato">
              <p className="font-mono-ed text-[11px] uppercase tracking-[0.2em] text-ink-3">
                Contato
              </p>
              <ul className="mt-4 space-y-2.5">
                <li>
                  <a
                    href="#contato"
                    className="font-sans-ed text-sm text-ink-2 transition-colors hover:text-ink"
                  >
                    Fale com o time
                  </a>
                </li>
              </ul>
            </nav>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-2 border-t border-ink/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono-ed text-[11px] tracking-wide text-ink-3">© 2026 Jurídico IA</p>
          <p className="font-mono-ed text-[11px] tracking-wide text-ink-3">
            Menos operação. Mais advocacia.
          </p>
        </div>
        <p className="mt-3 font-mono-ed text-[11px] tracking-wide text-ink-3">
          Processamento de linguagem natural via Google Gemini.
        </p>
      </div>
    </footer>
  );
}
