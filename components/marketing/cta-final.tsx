import Link from "next/link";
import { Reveal } from "./reveal";
import { IconArrowRight, IconLockSecure } from "./icons";

export function CtaFinal() {
  return (
    <section className="relative overflow-hidden border-t border-silver/10 bg-[#080d17] py-28 sm:py-36">
      {/* Background radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[380px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30 blur-3xl"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(199,210,232,0.15) 0%, rgba(19,41,75,0.3) 60%, transparent 80%)",
        }}
      />

      <div className="mx-auto max-w-4xl px-5 text-center sm:px-8">
        <Reveal>
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-silver">
            17 · O Próximo Passo
          </span>
        </Reveal>

        <Reveal delayMs={100}>
          <h2 className="mt-4 font-display text-3xl font-black tracking-tight text-ice sm:text-5xl lg:text-6xl">
            Deixe o sistema <br />
            <span className="font-normal italic text-silver-2">
              cuidar do resto.
            </span>
          </h2>
        </Reveal>

        <Reveal delayMs={200}>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
            Sua advocacia ganha fôlego, seus prazos ganham precisão e seus clientes ganham transparência.
            Experimente o plano Free hoje mesmo.
          </p>
        </Reveal>

        <Reveal delayMs={300}>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/cadastro"
              className="group inline-flex items-center gap-2 rounded-sm border border-silver/60 bg-gradient-to-br from-silver to-silver-2 px-8 py-4 text-sm font-bold text-navy shadow-[0_8px_30px_rgba(199,210,232,0.25)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_12px_36px_rgba(199,210,232,0.35)] active:translate-y-0 active:scale-[0.98]"
            >
              Começar gratuitamente
              <IconArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1" />
            </Link>
            <a
              href="#caso-sistema"
              className="inline-flex items-center gap-2 rounded-sm border border-silver/20 bg-white/[0.03] px-7 py-4 text-sm font-medium text-ice transition-all duration-150 hover:border-silver/40 hover:bg-white/[0.08] active:scale-[0.98]"
            >
              Ver recursos completos
            </a>
          </div>
        </Reveal>

        <Reveal delayMs={400}>
          <p className="mt-6 text-xs text-muted">
            Sem cartão de crédito · Ativação instantânea · Cancele quando quiser
          </p>
        </Reveal>
      </div>
    </section>
  );
}
