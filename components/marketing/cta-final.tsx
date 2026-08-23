import Link from "next/link";
import { IconArrowRight } from "./icons";
import { Reveal } from "./reveal";

export function CtaFinal() {
  return (
    <section className="py-24 md:py-36">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-5 md:px-10 lg:grid-cols-[1.1fr_0.8fr]">
        <div>
          <Reveal>
            <h2 className="max-w-xl font-serif-ed text-4xl leading-[1.08] tracking-tight text-ink md:text-6xl">
              Deixe o sistema cuidar do <em className="italic">resto</em>.
            </h2>
          </Reveal>

          <Reveal delayMs={120}>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-2">
              Crie sua conta gratuita em minutos. Sem cartão para começar.
            </p>
          </Reveal>

          <Reveal delayMs={240}>
            <div className="mt-9 flex flex-wrap items-center gap-5">
              <Link
                href="/cadastro"
                className="group inline-flex items-center gap-2 rounded-none bg-ink px-7 py-3.5 text-sm font-medium text-paper transition-colors hover:bg-ink/90"
              >
                Começar gratuitamente
                <IconArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
              <a
                href="#planos"
                className="inline-flex items-center gap-2 border-b border-ink/25 pb-0.5 text-sm text-ink-2 transition-colors hover:border-ink hover:text-ink"
              >
                Ver planos
              </a>
            </div>
          </Reveal>
        </div>

        {/* Fecha o par com o hero: citação deslocada à direita retomando o
            motivo "cláusula" — agora com a promessa honesta do produto:
            revisão humana antes de qualquer peça. */}
        <Reveal delayMs={200} className="lg:justify-self-end">
          <div className="relative max-w-xs border-l-2 border-lacre/50 pl-6">
            <span
              aria-hidden
              className="absolute -left-3 -top-9 select-none font-serif-ed text-7xl italic text-lacre/15"
            >
              §
            </span>
            <p className="font-serif-ed text-xl italic leading-snug text-ink">
              Nenhuma peça sai daqui sem passar pela sua revisão.
            </p>
            <p className="mt-3 font-mono-ed text-[11px] uppercase tracking-[0.16em] text-ink-3">
              Cláusula final
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
