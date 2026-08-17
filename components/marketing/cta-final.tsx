import Link from "next/link";
import { IconArrowRight } from "./icons";

export function CtaFinal() {
  return (
    <section className="relative overflow-hidden bg-navy py-24 sm:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[380px] w-[780px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 blur-3xl"
        style={{ background: "radial-gradient(ellipse, rgba(201,168,76,.12) 0%, transparent 70%)" }}
      />

      <div className="relative mx-auto max-w-3xl px-5 text-center sm:px-8">
        <h2 className="font-display text-3xl font-black leading-tight text-ice sm:text-4xl lg:text-5xl">
          Sua próxima petição pode começar agora, não segunda-feira.
        </h2>
        <p className="mx-auto mt-5 max-w-lg text-base text-muted">
          Crie sua conta gratuita e gere sua primeira minuta com fundamentação
          legal em poucos minutos. Sem cartão de crédito.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/cadastro"
            className="group inline-flex items-center gap-2 rounded-sm bg-gradient-to-br from-gold to-gold-2 px-7 py-3.5 text-sm font-semibold text-navy shadow-[0_8px_32px_rgba(201,168,76,.25)] transition-transform hover:-translate-y-0.5"
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
      </div>
    </section>
  );
}
