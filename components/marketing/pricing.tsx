"use client";

import Link from "next/link";
import { Reveal } from "./reveal";
import { IconCheck, IconDash, IconLockSecure } from "./icons";

interface PlanFeature {
  label: string;
  included: boolean;
}

const PRECO_PRO_MENSAL = "R$ 149";

const FREE_FEATURES: PlanFeature[] = [
  { label: "Uso mensal inicial de IA", included: true },
  { label: "Chat jurídico fundamentado (CPC/CC/CF)", included: true },
  { label: "Triagem de clientes via link público", included: true },
  { label: "Controle manual de prazos", included: true },
  { label: "Exportação em DOCX e PDF formatados", included: true },
  { label: "Varredura automática diária do DJEN", included: false },
  { label: "Auditoria pré-assinatura de conformidade", included: false },
  { label: "Múltiplos advogados na mesma banca", included: false },
];

const PRO_FEATURES: PlanFeature[] = [
  { label: "Tudo do Free, com IA ilimitada para casos", included: true },
  { label: "Varredura automática diária do DJEN (PJe)", included: true },
  { label: "Auditoria pré-assinatura e red-teaming de teses", included: true },
  { label: "Portal do Cliente com consulta segura via CPF", included: true },
  { label: "Disparos automáticos e lembretes via WhatsApp", included: true },
  { label: "Gestão financeira de honorários e parcelas", included: true },
  { label: "Assinatura eletrônica com validade jurídica", included: true },
  { label: "Suporte prioritário via WhatsApp com especialista", included: true },
];

const FIRM_FEATURES: PlanFeature[] = [
  { label: "Tudo do Plano Pro para toda a equipe", included: true },
  { label: "Múltiplos advogados com controle de permissões", included: true },
  { label: "Memória institucional e cofre de teses da banca", included: true },
  { label: "Relatórios de produtividade e faturamento por sócio", included: true },
  { label: "Onboarding personalizado e migração de dados", included: true },
  { label: "Acordo de Nível de Serviço (SLA) dedicado", included: true },
];

export function Pricing() {
  return (
    <section id="precos" className="relative overflow-hidden border-t border-silver/10 bg-[#090f1a] py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <Reveal>
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-silver">
              14 · Planos e Investimento
            </span>
          </Reveal>
          <Reveal delayMs={100}>
            <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-ice sm:text-4xl lg:text-5xl">
              Transparência absoluta. <br />
              <span className="font-normal italic text-silver-2">
                Sem taxas ocultas ou fidelidade.
              </span>
            </h2>
          </Reveal>
          <Reveal delayMs={200}>
            <p className="mt-5 text-base leading-relaxed text-muted sm:text-lg">
              Comece gratuitamente para testar o sistema no seu ritmo.
              Evolua para o plano Pro quando quiser automatizar sua rotina.
            </p>
          </Reveal>
        </div>

        {/* 3 Plans Grid */}
        <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-stretch">
          {/* FREE PLAN */}
          <div className="flex flex-col justify-between rounded-md border border-silver/15 bg-black/30 p-6 sm:p-8">
            <div>
              <span className="font-mono text-xs text-silver uppercase font-semibold">FREE</span>
              <h3 className="mt-2 font-display text-xl font-bold text-ice">Para Experimentar</h3>
              <p className="mt-1 text-xs text-muted leading-relaxed">
                Ideal para advogados autônomos conhecerem a precisão do copiloto.
              </p>
              <div className="mt-6 flex items-baseline gap-1 border-b border-silver/10 pb-6">
                <span className="font-display text-3xl font-black text-ice">R$ 0</span>
                <span className="text-xs text-muted">/mês</span>
              </div>
              <ul className="mt-6 space-y-3 text-xs">
                {FREE_FEATURES.map((feat) => (
                  <li
                    key={feat.label}
                    className={`flex items-start gap-2.5 ${
                      feat.included ? "text-ice-2" : "text-muted/40"
                    }`}
                  >
                    {feat.included ? (
                      <IconCheck className="h-4 w-4 shrink-0 text-silver mt-0.5" />
                    ) : (
                      <IconDash className="h-4 w-4 shrink-0 text-muted/30 mt-0.5" />
                    )}
                    <span>{feat.label}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Link
              href="/cadastro"
              className="mt-8 block rounded-sm border border-silver/20 bg-white/[0.03] py-3 text-center text-xs font-semibold text-ice hover:border-silver/40 hover:bg-white/[0.08] transition-all"
            >
              Criar Conta Gratuita
            </Link>
          </div>

          {/* PRO PLAN (HIGHLIGHTED) */}
          <div className="relative flex flex-col justify-between rounded-md border border-silver bg-[#0e172a] p-6 sm:p-8 shadow-[0_12px_40px_rgba(199,210,232,0.12)]">
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-silver via-white to-silver"
            />
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-silver uppercase font-semibold">PRO</span>
                <span className="font-mono text-[10px] text-navy bg-silver px-2.5 py-0.5 rounded font-bold uppercase">
                  MAIS ESCOLHIDO
                </span>
              </div>
              <h3 className="mt-2 font-display text-xl font-bold text-ice">Para o Dia a Dia</h3>
              <p className="mt-1 text-xs text-muted leading-relaxed">
                Automação completa de prazos, petições e atendimento para bancas ágeis.
              </p>
              <div className="mt-6 flex items-baseline gap-1 border-b border-silver/10 pb-6">
                <span className="font-display text-3xl font-black text-ice">{PRECO_PRO_MENSAL}</span>
                <span className="text-xs text-muted">/mês</span>
              </div>
              <ul className="mt-6 space-y-3 text-xs">
                {PRO_FEATURES.map((feat) => (
                  <li key={feat.label} className="flex items-start gap-2.5 text-ice-2">
                    <IconCheck className="h-4 w-4 shrink-0 text-silver mt-0.5" />
                    <span>{feat.label}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Link
              href="/cadastro"
              className="mt-8 block rounded-sm bg-gradient-to-br from-silver to-silver-2 py-3 text-center text-xs font-bold text-navy shadow-[0_4px_16px_rgba(199,210,232,0.2)] hover:opacity-90 transition-all"
            >
              Assinar Plano Pro
            </Link>
          </div>

          {/* FIRM PLAN */}
          <div className="flex flex-col justify-between rounded-md border border-silver/15 bg-black/30 p-6 sm:p-8">
            <div>
              <span className="font-mono text-xs text-silver uppercase font-semibold">FIRM</span>
              <h3 className="mt-2 font-display text-xl font-bold text-ice">Para Bancas & Equipes</h3>
              <p className="mt-1 text-xs text-muted leading-relaxed">
                Gestão centralizada, cofre de teses e múltiplos advogados com perfis dedicados.
              </p>
              <div className="mt-6 flex items-baseline gap-1 border-b border-silver/10 pb-6">
                <span className="font-display text-2xl font-bold text-ice">Sob Consulta</span>
              </div>
              <ul className="mt-6 space-y-3 text-xs">
                {FIRM_FEATURES.map((feat) => (
                  <li key={feat.label} className="flex items-start gap-2.5 text-ice-2">
                    <IconCheck className="h-4 w-4 shrink-0 text-silver mt-0.5" />
                    <span>{feat.label}</span>
                  </li>
                ))}
              </ul>
            </div>
            <a
              href="mailto:contato@juridico-ia.com.br?subject=Plano%20Firm%20-%20Jurídico%20IA"
              className="mt-8 block rounded-sm border border-silver/20 bg-white/[0.03] py-3 text-center text-xs font-semibold text-ice hover:border-silver/40 hover:bg-white/[0.08] transition-all"
            >
              Falar com Especialista
            </a>
          </div>
        </div>

        {/* Micro-guarantee */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <IconLockSecure className="h-3.5 w-3.5 text-silver" />
            Cancele a qualquer momento com 1 clique
          </span>
          <span>·</span>
          <span>Emissão imediata de Nota Fiscal</span>
          <span>·</span>
          <span>Atendimento 100% brasileiro</span>
        </div>
      </div>
    </section>
  );
}
