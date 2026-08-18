import Link from "next/link";
import { Reveal } from "./reveal";
import { IconCheck, IconDash } from "./icons";

interface PlanFeature {
  label: string;
  included: boolean;
}

const FREE_FEATURES: PlanFeature[] = [
  { label: "Uso mensal de IA limitado", included: true },
  { label: "Chat jurídico (petições, contratos, pareceres)", included: true },
  { label: "Triagem de clientes", included: true },
  { label: "Controle de prazos", included: true },
  { label: "Exportação em DOCX/PDF", included: true },
  { label: "Biblioteca de modelos", included: false },
  { label: "Múltiplos advogados no time", included: false },
];

const PRO_FEATURES: PlanFeature[] = [
  { label: "Uso mensal de IA ampliado", included: true },
  { label: "Chat jurídico (petições, contratos, pareceres)", included: true },
  { label: "Triagem de clientes", included: true },
  { label: "Controle de prazos", included: true },
  { label: "Exportação em DOCX/PDF", included: true },
  { label: "Biblioteca de modelos", included: true },
  { label: "Múltiplos advogados no time", included: true },
];

export function Pricing() {
  return (
    <section id="precos" className="bg-navy py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <div className="mb-16 max-w-xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-gold">
            Planos
          </p>
          <h2 className="font-display text-3xl font-bold leading-tight text-ice sm:text-4xl">
            Comece sem custo, cresça quando precisar
          </h2>
          <p className="mt-4 text-muted">
            O plano Pro está em construção. Quem entra pelo Free hoje é
            avisado em primeira mão quando ele abrir.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Reveal>
            <div className="flex h-full flex-col rounded-md border border-white/10 bg-navy-2/50 p-8 transition-transform duration-300 ease-out will-change-transform hover:-translate-y-1.5">
              <h3 className="font-display text-lg font-bold text-ice">Free</h3>
              <p className="mt-1.5 text-sm text-muted">
                Para advogados autônomos testarem o copiloto no dia a dia.
              </p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="font-display text-4xl font-black text-ice">
                  R$ 0
                </span>
                <span className="text-sm text-muted">/mês</span>
              </div>
              <ul className="mt-7 flex flex-1 flex-col gap-3">
                {FREE_FEATURES.map((feature) => (
                  <li
                    key={feature.label}
                    className={`flex items-center gap-2.5 text-sm ${
                      feature.included ? "text-ice-2" : "text-muted/60"
                    }`}
                  >
                    {feature.included ? (
                      <IconCheck className="h-4 w-4 shrink-0 text-gold" />
                    ) : (
                      <IconDash className="h-4 w-4 shrink-0 text-muted/60" />
                    )}
                    {feature.label}
                  </li>
                ))}
              </ul>
              <Link
                href="/cadastro"
                className="mt-8 rounded-sm border border-white/15 px-5 py-3 text-center text-sm font-semibold text-ice transition-colors hover:border-white/30 hover:bg-white/5"
              >
                Criar conta grátis
              </Link>
            </div>
          </Reveal>

          <Reveal delayMs={100}>
            <div className="relative flex h-full flex-col overflow-hidden rounded-md border border-gold/40 bg-navy-3/70 p-8 transition-transform duration-300 ease-out will-change-transform hover:-translate-y-1.5">
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-gold to-gold-2"
              />
              <span className="mb-4 inline-flex w-fit items-center rounded-full bg-gradient-to-br from-gold to-gold-2 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-navy">
                Em breve
              </span>
              <h3 className="font-display text-lg font-bold text-ice">Pro</h3>
              <p className="mt-1.5 text-sm text-muted">
                Para escritórios com mais de um advogado e volume maior de
                peças por mês.
              </p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="font-display text-2xl font-black text-gold-2">
                  Lista de espera
                </span>
              </div>
              <ul className="mt-7 flex flex-1 flex-col gap-3">
                {PRO_FEATURES.map((feature) => (
                  <li key={feature.label} className="flex items-center gap-2.5 text-sm text-ice-2">
                    <IconCheck className="h-4 w-4 shrink-0 text-gold" />
                    {feature.label}
                  </li>
                ))}
              </ul>
              <Link
                href="/cadastro"
                className="mt-8 rounded-sm bg-gradient-to-br from-gold to-gold-2 px-5 py-3 text-center text-sm font-semibold text-navy transition-transform hover:-translate-y-0.5"
              >
                Entrar na lista de espera
              </Link>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
