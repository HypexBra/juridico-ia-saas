"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { IconCheck } from "./icons";
import { Reveal } from "./reveal";
import { Section } from "./section";

/** Preços exibidos aqui são só cópia/UI — a cobrança real usa STRIPE_PRICE_ID_PRO_MENSAL
 * (fonte de verdade, ver lib/billing/stripe-client.ts). Mantenha sincronizado ao trocar
 * o valor no Stripe (o mesmo valor também aparece em components/app/assinatura-card.tsx).
 * O plano anual (2 meses grátis) é cobrança única de R$ 1.490/ano — ainda sem price ID
 * dedicado no Stripe; o CTA do Pro segue apontando para /cadastro nos dois modos até o
 * checkout anual existir. */
const PRECO_PRO_MENSAL = "R$ 149";
const PRECO_PRO_ANUAL_MES = "R$ 124,17";
const PRECO_PRO_ANUAL_TOTAL = "R$ 1.490";

type Periodicidade = "mensal" | "anual";

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
  precoNota?: string;
  selo?: string;
  destaque?: boolean;
  features: PlanFeature[];
  rodape: React.ReactNode;
}

function Plano({ nome, lema, preco, precoNota, selo, destaque = false, features, rodape }: PlanoProps) {
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
        <div className="mt-6">
          <p className="flex items-baseline gap-1.5">
            <span className="font-serif-ed text-4xl text-ink">{preco}</span>
            <span className="text-sm text-ink-3">/mês</span>
          </p>
          {precoNota ? <p className="mt-1 text-xs text-ink-3">{precoNota}</p> : null}
          {selo ? (
            <span className="mt-2 inline-block border border-accent/30 bg-accent/10 px-2 py-0.5 font-mono-ed text-[10px] uppercase tracking-[0.14em] text-accent">
              {selo}
            </span>
          ) : null}
        </div>
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

/** Toggle Mensal/Anual — dois botões estilo "segmented control" no traço
 * editorial do site (rodape-none, hairline ink/15), sem lib externa. */
function TogglePeriodicidade({
  valor,
  onChange,
}: {
  valor: Periodicidade;
  onChange: (valor: Periodicidade) => void;
}) {
  const groupId = useId();
  return (
    <div
      role="group"
      aria-label="Periodicidade de cobrança"
      className="inline-flex border border-ink/15 p-1"
    >
      {(
        [
          { valor: "mensal" as const, label: "Mensal" },
          { valor: "anual" as const, label: "Anual" },
        ]
      ).map((opcao) => (
        <button
          key={opcao.valor}
          type="button"
          id={`${groupId}-${opcao.valor}`}
          aria-pressed={valor === opcao.valor}
          onClick={() => onChange(opcao.valor)}
          className={`px-4 py-2 font-sans-ed text-sm font-medium transition-colors ${
            valor === opcao.valor
              ? "bg-ink text-paper"
              : "text-ink-2 hover:text-ink"
          }`}
        >
          {opcao.label}
          {opcao.valor === "anual" ? (
            <span
              className={`ml-2 font-mono-ed text-[10px] uppercase tracking-[0.12em] ${
                valor === opcao.valor ? "text-paper/70" : "text-accent"
              }`}
            >
              2 meses grátis
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function Pricing() {
  const [periodicidade, setPeriodicidade] = useState<Periodicidade>("mensal");
  const anual = periodicidade === "anual";

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
      <Reveal>
        <div className="flex justify-center md:justify-start">
          <TogglePeriodicidade valor={periodicidade} onChange={setPeriodicidade} />
        </div>
      </Reveal>

      {/* Três larguras deliberadamente diferentes e alturas assimétricas
          (Pro mais largo e descido) — nada de trio de cards idênticos. */}
      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-[1fr_1.15fr_0.85fr] md:items-start">
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
            preco={anual ? PRECO_PRO_ANUAL_MES : PRECO_PRO_MENSAL}
            precoNota={anual ? `Cobrança anual de ${PRECO_PRO_ANUAL_TOTAL}` : undefined}
            selo={anual ? "2 meses grátis" : undefined}
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
              <a
                href="mailto:pedrohenriquesanchesleal4@gmail.com?subject=Interesse%20no%20plano%20Firm"
                className="block rounded-none border border-ink/20 px-5 py-3 text-center text-sm font-medium text-ink transition-colors hover:border-ink/40 hover:bg-paper-2"
              >
                Entrar na lista de espera
              </a>
            }
          />
        </Reveal>
      </div>

      <Reveal delayMs={250}>
        <p className="mx-auto mt-12 max-w-md text-center text-sm text-ink-3">
          {anual
            ? "O plano Pro anual é cobrado uma vez por ano pelo Stripe, equivalente a 10 meses. Cancele quando quiser, direto no perfil."
            : "O plano Pro é cobrado mensalmente pelo Stripe. Cancele quando quiser, direto no perfil."}
        </p>
      </Reveal>
    </Section>
  );
}
