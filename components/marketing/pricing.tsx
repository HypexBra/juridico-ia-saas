import Link from "next/link";
import { IconCheck } from "./icons";
import { Reveal } from "./reveal";
import { Section } from "./section";

/** Preço exibido aqui é só cópia/UI — a cobrança real usa STRIPE_PRICE_ID_PRO_MENSAL (fonte de verdade, ver lib/billing/stripe-client.ts). Mantenha sincronizado ao trocar o valor no Stripe (o mesmo valor também aparece em components/app/assinatura-card.tsx). */
const PRECO_PRO_MENSAL = "R$ 149";

interface PlanFeature {
  label: string;
}

const FREE_FEATURES: PlanFeature[] = [
  { label: "Uso mensal de IA limitado" },
  { label: "Casos, clientes, prazos e tarefas" },
  { label: "Triagem de clientes" },
  { label: "Chat jurídico com o contexto do caso" },
  { label: "Portal do cliente" },
];

const PRO_FEATURES: PlanFeature[] = [
  { label: "Tudo do Free, sem limite mensal de IA" },
  { label: "Análise de processos e auditoria de peças" },
  { label: "Advogado do contra e estratégia por caso" },
  { label: "Pesquisa jurisprudencial verificável (STJ)" },
  { label: "Workflows e modelos preenchidos pelo caso" },
  { label: "Equipe com múltiplos advogados" },
];

interface PlanoProps {
  nome: string;
  lema: string;
  preco?: string;
  destaque?: boolean;
  features: PlanFeature[];
  rodape: React.ReactNode;
}

function Plano({ nome, lema, preco, destaque = false, features, rodape }: PlanoProps) {
  return (
    <div
      className={`relative flex h-full flex-col rounded-none border p-8 ${
        destaque ? "border-ink/25 bg-paper-2" : "border-ink/10 bg-paper"
      }`}
    >
      {destaque ? (
        <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-accent" />
      ) : null}
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-serif-ed text-xl font-semibold text-ink">{nome}</h3>
        {destaque ? (
          <span className="font-mono-ed text-[11px] uppercase tracking-[0.16em] text-accent">
            Recomendado
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 text-sm text-ink-2">{lema}</p>
      {preco ? (
        <p className="mt-6 flex items-baseline gap-1.5">
          <span className="font-serif-ed text-4xl text-ink">{preco}</span>
          <span className="text-sm text-ink-3">/mês</span>
        </p>
      ) : null}
      <ul className="mt-7 flex flex-1 flex-col gap-3">
        {features.map((feature) => (
          <li key={feature.label} className="flex items-start gap-2.5 text-sm text-ink-2">
            <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
            {feature.label}
          </li>
        ))}
      </ul>
      <div className="mt-8">{rodape}</div>
    </div>
  );
}

export function Pricing() {
  return (
    <Section
      id="planos"
      numero="14"
      kicker="Planos"
      titulo={
        <>
          Comece sem custo. Automatize quando fizer sentido.
        </>
      }
      intro="Assine quando quiser, cancele quando quiser — sem fidelidade."
    >
      {/* Três larguras deliberadamente diferentes e alturas assimétricas
          (Pro mais largo e descido) — nada de trio de cards idênticos. */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_1.15fr_0.85fr] md:items-start">
        <Reveal>
          <Plano
            nome="Free"
            lema="Para experimentar."
            preco="R$ 0"
            features={FREE_FEATURES}
            rodape={
              <Link
                href="/cadastro"
                className="block rounded-none border border-ink/20 px-5 py-3 text-center text-sm font-medium text-ink transition-colors hover:border-ink/40 hover:bg-paper-2"
              >
                Criar conta grátis
              </Link>
            }
          />
        </Reveal>

        <Reveal delayMs={100} className="md:mt-10">
          <Plano
            nome="Pro"
            lema="Para quem quer automatizar."
            preco={PRECO_PRO_MENSAL}
            destaque
            features={PRO_FEATURES}
            rodape={
              <Link
                href="/cadastro"
                className="block rounded-none bg-ink px-5 py-3 text-center text-sm font-medium text-paper transition-colors hover:bg-ink/90"
              >
                Assinar o plano Pro
              </Link>
            }
          />
        </Reveal>

        <Reveal delayMs={200}>
          <Plano
            nome="Firm"
            lema="Para escritórios."
            features={[
              { label: "Múltiplos usuários e permissões" },
              { label: "Modelos e conhecimento privados" },
              { label: "Workflows avançados" },
            ]}
            rodape={
              <p className="font-mono-ed text-xs uppercase tracking-[0.16em] text-ink-3">
                Em breve
              </p>
            }
          />
        </Reveal>
      </div>

      <Reveal delayMs={250}>
        <p className="mx-auto mt-12 max-w-md text-center text-sm text-ink-3">
          O plano Pro é cobrado mensamente pelo Stripe. Cancele quando quiser,
          direto no perfil.
        </p>
      </Reveal>
    </Section>
  );
}
