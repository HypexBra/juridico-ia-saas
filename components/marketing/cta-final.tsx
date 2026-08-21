import Link from "next/link";
import { Reveal } from "./reveal";
import { IconArrowRight, IconLockSecure } from "./icons";

export function CtaFinal() {
  return (
    <section className="relative overflow-hidden border-t border-white/[0.08] bg-[#09090b] py-32 sm:py-40">
      {/* Background Champagne Glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[400px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-25 blur-[100px]"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(212,175,55,0.3) 0%, rgba(18,18,22,0.6) 70%, transparent 80%)",
        }}
      />

      <div className="mx-auto max-w-4xl px-5 text-center sm:px-8">
        <Reveal>
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
            17 · O Próximo Passo
          </span>
        </Reveal>

        <Reveal delayMs={100}>
          <h2 className="mt-4 font-display text-4xl font-black tracking-tight text-[#fafaf9] sm:text-6xl lg:text-7xl">
            Deixe o sistema <br />
            <span className="font-normal italic text-[#d4af37]">
              cuidar do resto.
            </span>
          </h2>
        </Reveal>

        <Reveal delayMs={200}>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-[#a1a1aa] sm:text-lg">
            Sua advocacia ganha fôlego, seus prazos ganham precisão e seus clientes ganham transparência.
            Crie sua conta e experimente o plano Free hoje mesmo.
          </p>
        </Reveal>

        <Reveal delayMs={300}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/cadastro"
              className="group inline-flex items-center gap-2.5 rounded-sm border border-[#d4af37] bg-gradient-to-br from-[#d4af37] to-[#e5c07b] px-9 py-4 text-sm font-bold text-[#09090b] shadow-[0_8px_32px_rgba(212,175,55,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_42px_rgba(212,175,55,0.45)] active:translate-y-0 active:scale-[0.98]"
            >
              Começar gratuitamente
              <IconArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1" />
            </Link>
            <a
              href="#dossie"
              className="inline-flex items-center gap-2 rounded-sm border border-white/15 bg-white/[0.03] px-8 py-4 text-sm font-medium text-[#fafaf9] transition-all duration-150 hover:border-[#d4af37]/50 hover:bg-white/[0.08] active:scale-[0.98]"
            >
              Ver studio do caso
            </a>
          </div>
        </Reveal>

        <Reveal delayMs={400}>
          <p className="mt-7 text-xs text-[#a1a1aa]">
            Sem cartão de crédito · Ativação instantânea · Cancele quando quiser
          </p>
        </Reveal>
      </div>
    </section>
  );
}
