import Link from "next/link";
import { HeroVisual } from "./hero-visual";
import { IconArrowRight, IconClock } from "./icons";
import { Reveal } from "./reveal";
import { TextReveal } from "./text-reveal";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 15% 0%, rgba(201,168,76,.10) 0%, transparent 60%), radial-gradient(ellipse 40% 40% at 100% 30%, rgba(22,42,82,.9) 0%, transparent 65%)",
        }}
      />

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-16 px-5 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-10">
        {/* Coluna de texto — alinhada à esquerda, sem centralização de hero genérico */}
        <div>
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/8 px-3.5 py-1.5 text-xs font-medium text-gold-2">
              <span className="h-1.5 w-1.5 rounded-full bg-green" />
              Fundamentação legal verificável · CF, CC, CPC, STF, STJ
            </span>
          </Reveal>

          <TextReveal
            as="h1"
            delayMs={150}
            className="mt-6 block max-w-xl font-display text-4xl font-black leading-[1.08] text-ice sm:text-5xl lg:text-[3.4rem]"
          >
            O associado que revisa cada petição antes de você assinar.
          </TextReveal>

          <Reveal delayMs={480}>
            <p className="mt-6 max-w-md text-base leading-relaxed text-muted sm:text-lg">
              Jurídico IA gera petições, contratos e pareceres com fundamentação
              legal real, faz a triagem dos seus clientes e controla os prazos
              do escritório — em um único painel, não em três sistemas soltos.
            </p>
          </Reveal>

          <Reveal delayMs={620}>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link
                href="/cadastro"
                className="group inline-flex items-center gap-2 rounded-sm bg-gradient-to-br from-gold to-gold-2 px-6 py-3.5 text-sm font-semibold text-navy shadow-[0_8px_32px_rgba(201,168,76,.25)] transition-transform hover:-translate-y-0.5"
              >
                Criar conta grátis
                <IconArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a
                href="#como-funciona"
                className="inline-flex items-center gap-2 rounded-sm border border-white/15 px-6 py-3.5 text-sm font-medium text-ice transition-colors hover:border-white/30 hover:bg-white/5"
              >
                Ver como funciona
              </a>
            </div>
          </Reveal>

          <Reveal delayMs={720}>
            <p className="mt-5 text-xs text-muted">
              Sem cartão de crédito · Plano Free com limite mensal de uso de IA
            </p>
          </Reveal>
        </div>

        {/* Coluna visual — mock de produto, não é screenshot real */}
        <HeroVisual>
          <div className="relative mx-auto w-full max-w-md lg:mx-0">
            <div
              aria-hidden
              className="absolute -inset-10 -z-10 rounded-full opacity-70 blur-3xl"
              style={{ background: "radial-gradient(circle, rgba(201,168,76,.14), transparent 70%)" }}
            />

            <div className="overflow-hidden rounded-lg border border-gold/20 bg-navy-2/90 shadow-[0_40px_80px_rgba(0,0,0,.5)]">
              <div className="flex items-center gap-2 border-b border-gold/10 bg-black/20 px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                <span className="ml-auto text-[11px] tracking-wide text-muted">
                  Novo caso · Trabalhista
                </span>
              </div>

              <div className="space-y-4 p-5">
                <div className="ml-auto max-w-[85%] rounded-md rounded-tr-sm border border-gold/20 bg-gold/10 px-4 py-3 text-[13px] leading-relaxed text-gold-3">
                  Cliente dispensado sem justa causa após 3 anos, horas extras
                  não pagas e FGTS em atraso há 6 meses. Salário de R$ 4.200.
                </div>

                <div className="max-w-[92%] rounded-md rounded-tl-sm border border-white/8 bg-white/[.04] px-4 py-3 text-[13px] leading-relaxed text-ice-2">
                  <p className="mb-2 font-semibold text-ice">
                    Questões jurídicas identificadas
                  </p>
                  <ul className="space-y-1 text-ice-2/90">
                    <li>Horas extras habituais (art. 59, CLT)</li>
                    <li>FGTS em atraso — multa de 40% (Lei 8.036/90)</li>
                    <li>Verbas rescisórias (art. 477, §8º, CLT)</li>
                  </ul>
                  <p className="mt-3 text-muted">
                    Gerando petição inicial com pedido de tutela de urgência
                    <span className="ml-1 inline-block h-3 w-[2px] animate-pulse bg-gold align-middle" />
                  </p>
                </div>
              </div>
            </div>

            {/* Widget flutuante — prazos, mostra que o produto vai além do chat */}
            <div className="absolute -bottom-6 -left-6 hidden w-56 rounded-md border border-gold/25 bg-navy-3/95 p-4 shadow-2xl sm:block">
              <div className="mb-2 flex items-center gap-2 text-gold">
                <IconClock className="h-4 w-4" />
                <span className="text-[11px] font-semibold uppercase tracking-wide">
                  Prazos
                </span>
              </div>
              <p className="text-xs leading-snug text-ice-2">
                Contestação · Proc. 0004521-33
              </p>
              <p className="mt-1 text-xs font-semibold text-gold-2">
                Vence em 3 dias
              </p>
            </div>
          </div>
        </HeroVisual>
      </div>
    </section>
  );
}
