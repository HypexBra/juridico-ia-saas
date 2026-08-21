import Link from "next/link";
import { HeroCaseEngine } from "./hero-case-engine";
import { IconArrowRight, IconLockSecure } from "./icons";
import { Reveal } from "./reveal";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-28 pb-20 sm:pt-36 sm:pb-28 lg:pt-40 lg:pb-32">
      {/* Subtle architectural grid lines */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(199,210,232,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(199,210,232,0.03)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"
      />

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-14">
          {/* Left Editorial Column */}
          <div>
            <Reveal>
              <div className="inline-flex items-center gap-2.5 rounded-sm border border-silver/20 bg-silver/5 px-3 py-1 text-[11px] font-mono font-medium text-silver-2 uppercase tracking-wider">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span>Sistema Operacional para Advocacia</span>
              </div>
            </Reveal>

            <Reveal delayMs={100}>
              <h1 className="mt-6 font-display text-4xl font-black leading-[1.08] tracking-tight text-ice sm:text-5xl lg:text-[3.8rem]">
                Menos operação. <br />
                <span className="italic font-normal text-silver-2">Mais advocacia.</span>
              </h1>
            </Reveal>

            <Reveal delayMs={200}>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
                Casos, documentos, prazos do DJEN, redação jurídica fundamentada e portal do cliente
                em um ambiente único e sincronizado. A tecnologia cuida da operação; você decide a estratégia.
              </p>
            </Reveal>

            <Reveal delayMs={300}>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  href="/cadastro"
                  className="group inline-flex items-center gap-2 rounded-sm border border-silver/60 bg-gradient-to-br from-silver to-silver-2 px-6 py-3.5 text-sm font-semibold text-navy shadow-[0_4px_20px_rgba(199,210,232,0.2)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(199,210,232,0.3)] active:translate-y-0 active:scale-[0.98]"
                >
                  Começar gratuitamente
                  <IconArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1" />
                </Link>
                <a
                  href="#caso-sistema"
                  className="inline-flex items-center gap-2 rounded-sm border border-silver/20 bg-white/[0.03] px-6 py-3.5 text-sm font-medium text-ice-2 transition-all duration-150 hover:border-silver/40 hover:bg-white/[0.07] active:scale-[0.98]"
                >
                  Explorar o sistema
                </a>
              </div>
            </Reveal>

            <Reveal delayMs={400}>
              <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted">
                <span className="flex items-center gap-1.5">
                  <IconLockSecure className="h-3.5 w-3.5 text-silver/70" />
                  Isolamento total de dados
                </span>
                <span>·</span>
                <span>Sem cartão de crédito</span>
                <span>·</span>
                <span>Fundamentação legal verificável</span>
              </div>
            </Reveal>
          </div>

          {/* Right Hero Visual Engine */}
          <Reveal delayMs={150}>
            <HeroCaseEngine />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
