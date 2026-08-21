import Link from "next/link";
import { HeroInteractiveStudio } from "./hero-interactive-studio";
import { IconArrowRight, IconLockSecure } from "./icons";
import { Reveal } from "./reveal";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-24 sm:pt-40 sm:pb-32 lg:pt-44 lg:pb-36">
      {/* Background Architectural Grid Lines */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:4.5rem_4.5rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"
      />

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[1.1fr_1.15fr] lg:items-center lg:gap-14">
          {/* Left Column: Editorial Manifesto & Typography */}
          <div>
            <Reveal>
              <div className="inline-flex items-center gap-2.5 rounded-sm border border-[#d4af37]/30 bg-[#d4af37]/10 px-3.5 py-1.5 text-[11px] font-mono font-medium text-[#d4af37] uppercase tracking-wider">
                <span className="h-1.5 w-1.5 rounded-full bg-[#10b981]" />
                <span>O Sistema Operacional Jurídico</span>
              </div>
            </Reveal>

            <Reveal delayMs={100}>
              <h1 className="mt-7 font-display text-4xl font-black leading-[1.08] tracking-tight text-[#fafaf9] sm:text-6xl lg:text-[4rem]">
                Menos operação. <br />
                <span className="italic font-normal text-[#d4af37]">Mais advocacia.</span>
              </h1>
            </Reveal>

            <Reveal delayMs={200}>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-[#a1a1aa] sm:text-lg">
                Um ambiente único e orquestrado onde autos, contratos, jurisprudência do STJ,
                intimações do DJEN e clientes convivem em sincronia contínua.
                A tecnologia trabalha nos bastidores; você decide a estratégia.
              </p>
            </Reveal>

            <Reveal delayMs={300}>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <Link
                  href="/cadastro"
                  className="group inline-flex items-center gap-2.5 rounded-sm border border-[#d4af37] bg-gradient-to-br from-[#d4af37] to-[#e5c07b] px-7 py-4 text-sm font-bold text-[#09090b] shadow-[0_4px_24px_rgba(212,175,55,0.25)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(212,175,55,0.4)] active:translate-y-0 active:scale-[0.98]"
                >
                  Começar gratuitamente
                  <IconArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1" />
                </Link>
                <a
                  href="#dossie"
                  className="inline-flex items-center gap-2 rounded-sm border border-white/15 bg-white/[0.03] px-7 py-4 text-sm font-medium text-[#fafaf9] transition-all duration-150 hover:border-[#d4af37]/50 hover:bg-white/[0.08] active:scale-[0.98]"
                >
                  Explorar o studio de caso
                </a>
              </div>
            </Reveal>

            <Reveal delayMs={400}>
              <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-[#a1a1aa]">
                <span className="flex items-center gap-1.5">
                  <IconLockSecure className="h-3.5 w-3.5 text-[#d4af37]" />
                  Isolamento total de dados por banca
                </span>
                <span>·</span>
                <span>Sem cartão de crédito</span>
                <span>·</span>
                <span>Precedentes verificáveis</span>
              </div>
            </Reveal>
          </div>

          {/* Right Column: Interactive Studio */}
          <Reveal delayMs={150}>
            <HeroInteractiveStudio />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
