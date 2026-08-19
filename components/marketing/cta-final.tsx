import Link from "next/link";
import { IconArrowRight } from "./icons";
import { LightBeam } from "./light-beam";
import { Reveal } from "./reveal";
import { TextReveal } from "./text-reveal";

export function CtaFinal() {
  return (
    <section className="relative overflow-hidden py-24 sm:py-28">
      <LightBeam angle={204} origin="bottom-left" className="-z-10" />
      <div
        aria-hidden
        className="cta-glow pointer-events-none absolute left-[38%] top-1/2 -z-10 h-[380px] w-[780px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 blur-3xl"
        style={{ background: "radial-gradient(ellipse, rgba(199,210,232,.12) 0%, transparent 70%)" }}
      />

      {/* Fecha o par com o hero: texto grande à esquerda, elemento
          deslocado à direita — nunca centralizado. A citação "§" retoma o
          motivo de "cláusula/artigo" usado em Features. */}
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-5 sm:px-8 lg:grid-cols-[1.1fr_0.8fr]">
        <div>
          <TextReveal
            as="h2"
            trigger="scroll"
            className="block max-w-xl font-display text-3xl font-black leading-tight text-ice sm:text-4xl lg:text-5xl"
          >
            Sua próxima petição pode começar agora, não segunda-feira.
          </TextReveal>

          <Reveal delayMs={250}>
            <p className="mt-5 max-w-md text-base text-muted">
              Crie sua conta gratuita e gere sua primeira minuta com
              fundamentação legal em poucos minutos. Sem cartão de crédito.
            </p>
          </Reveal>

          <Reveal delayMs={400}>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link
                href="/cadastro"
                className="group inline-flex items-center gap-2 rounded-sm bg-gradient-to-br from-silver to-silver-2 px-7 py-3.5 text-sm font-semibold text-navy shadow-[0_8px_32px_rgba(199,210,232,.25)] transition-transform hover:-translate-y-0.5"
              >
                Criar conta grátis
                <IconArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a
                href="#funcionalidades"
                className="inline-flex items-center gap-2 rounded-sm border border-white/15 px-7 py-3.5 text-sm font-medium text-ice transition-colors hover:border-white/30 hover:bg-white/5"
              >
                Ver funcionalidades
              </a>
            </div>
          </Reveal>
        </div>

        <Reveal delayMs={200} className="lg:justify-self-end">
          <div className="relative max-w-xs border-l-2 border-silver/40 pl-6">
            <span
              aria-hidden
              className="absolute -left-3 -top-8 select-none font-display text-7xl font-black text-silver/15"
            >
              §
            </span>
            <p className="font-display text-xl italic leading-snug text-ice-2">
              Nenhuma petição sai sem fundamentação verificável.
            </p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-silver">
              Cláusula final
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
