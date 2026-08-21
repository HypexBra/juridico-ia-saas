"use client";

import { useState } from "react";
import Link from "next/link";
import { Reveal } from "./reveal";
import { IconCheck, IconDash, IconLockSecure } from "./icons";

interface PlanFeature {
  label: string;
  included: boolean;
}

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
  { label: "Suporte prioritário com especialista", included: true },
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
  const [annual, setAnnual] = useState(false);

  return (
    <section id="precos" className="relative overflow-hidden border-t border-white/[0.08] bg-[#0c0c0f] py-28 sm:py-36">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-3xl">
          <Reveal>
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
              14 · Planos e Investimento
            </span>
          </Reveal>
          <Reveal delayMs={100}>
            <h2 className="mt-4 font-display text-4xl font-bold leading-tight text-[#fafaf9] sm:text-5xl lg:text-6xl">
              Transparência absoluta. <br />
              <span className="font-normal italic text-[#d4af37]">
                Sem taxas ocultas ou fidelidade.
              </span>
            </h2>
          </Reveal>
          <Reveal delayMs={200}>
            <p className="mt-6 text-base leading-relaxed text-[#a1a1aa] sm:text-lg">
              Comece gratuitamente para testar o sistema no seu ritmo.
              Evolua para o plano Pro quando quiser automatizar sua rotina.
            </p>
          </Reveal>

          {/* Billing Switch */}
          <Reveal delayMs={250}>
            <div className="mt-8 flex items-center gap-3 text-xs font-mono">
              <span className={annual ? "text-[#a1a1aa]" : "text-[#fafaf9] font-bold"}>MENSAL</span>
              <button
                type="button"
                onClick={() => setAnnual(!annual)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  annual ? "bg-[#d4af37]" : "bg-white/20"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-[#09090b] transition-transform ${
                    annual ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
              <span className={annual ? "text-[#d4af37] font-bold" : "text-[#a1a1aa]"}>
                ANUAL (2 MESES GRÁTIS)
              </span>
            </div>
          </Reveal>
        </div>

        {/* 3 Plans Grid */}
        <div className="mt-16 grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-stretch">
          {/* FREE PLAN */}
          <div className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#121216] p-6 sm:p-8">
            <div>
              <span className="font-mono text-xs text-[#a1a1aa] uppercase font-semibold">FREE</span>
              <h3 className="mt-2 font-display text-2xl font-bold text-[#fafaf9]">Para Experimentar</h3>
              <p className="mt-1.5 text-xs text-[#a1a1aa] leading-relaxed">
                Ideal para advogados autônomos conhecerem a precisão do sistema.
              </p>
              <div className="mt-6 flex items-baseline gap-1 border-b border-white/[0.08] pb-6">
                <span className="font-display text-4xl font-black text-[#fafaf9]">R$ 0</span>
                <span className="text-xs text-[#a1a1aa]">/mês</span>
              </div>
              <ul className="mt-6 space-y-3.5 text-xs">
                {FREE_FEATURES.map((feat) => (
                  <li
                    key={feat.label}
                    className={`flex items-start gap-2.5 ${
                      feat.included ? "text-[#fafaf9]" : "text-[#a1a1aa]/40"
                    }`}
                  >
                    {feat.included ? (
                      <IconCheck className="h-4 w-4 shrink-0 text-[#d4af37] mt-0.5" />
                    ) : (
                      <IconDash className="h-4 w-4 shrink-0 text-[#a1a1aa]/30 mt-0.5" />
                    )}
                    <span>{feat.label}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Link
              href="/cadastro"
              className="mt-8 block rounded-sm border border-white/[0.15] bg-white/[0.03] py-3 text-center text-xs font-semibold text-[#fafaf9] hover:border-[#d4af37]/50 hover:bg-white/[0.08] transition-all"
            >
              Criar Conta Gratuita
            </Link>
          </div>

          {/* PRO PLAN (HIGHLIGHTED IN GOLD) */}
          <div className="relative flex flex-col justify-between rounded-xl border border-[#d4af37] bg-[#18181f] p-6 sm:p-8 shadow-[0_20px_60px_rgba(212,175,55,0.18)]">
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-[#d4af37] via-[#fafaf9] to-[#d4af37]"
            />
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-[#d4af37] uppercase font-semibold">PRO</span>
                <span className="font-mono text-[10px] text-[#09090b] bg-[#d4af37] px-2.5 py-0.5 rounded font-bold uppercase">
                  MAIS ESCOLHIDO
                </span>
              </div>
              <h3 className="mt-2 font-display text-2xl font-bold text-[#fafaf9]">Para o Dia a Dia</h3>
              <p className="mt-1.5 text-xs text-[#a1a1aa] leading-relaxed">
                Automação completa de prazos, petições e atendimento para bancas ágeis.
              </p>
              <div className="mt-6 flex items-baseline gap-1 border-b border-white/[0.08] pb-6">
                <span className="font-display text-4xl font-black text-[#fafaf9]">
                  {annual ? "R$ 124" : "R$ 149"}
                </span>
                <span className="text-xs text-[#a1a1aa]">/mês</span>
              </div>
              <ul className="mt-6 space-y-3.5 text-xs">
                {PRO_FEATURES.map((feat) => (
                  <li key={feat.label} className="flex items-start gap-2.5 text-[#fafaf9]">
                    <IconCheck className="h-4 w-4 shrink-0 text-[#d4af37] mt-0.5" />
                    <span>{feat.label}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Link
              href="/cadastro"
              className="mt-8 block rounded-sm bg-gradient-to-br from-[#d4af37] to-[#e5c07b] py-3.5 text-center text-xs font-bold text-[#09090b] shadow-[0_4px_20px_rgba(212,175,55,0.3)] hover:opacity-90 transition-all"
            >
              Assinar Plano Pro
            </Link>
          </div>

          {/* FIRM PLAN */}
          <div className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#121216] p-6 sm:p-8">
            <div>
              <span className="font-mono text-xs text-[#a1a1aa] uppercase font-semibold">FIRM</span>
              <h3 className="mt-2 font-display text-2xl font-bold text-[#fafaf9]">Para Bancas & Equipes</h3>
              <p className="mt-1.5 text-xs text-[#a1a1aa] leading-relaxed">
                Gestão centralizada, cofre de teses e múltiplos advogados com perfis dedicados.
              </p>
              <div className="mt-6 flex items-baseline gap-1 border-b border-white/[0.08] pb-6">
                <span className="font-display text-3xl font-bold text-[#fafaf9]">Sob Consulta</span>
              </div>
              <ul className="mt-6 space-y-3.5 text-xs">
                {FIRM_FEATURES.map((feat) => (
                  <li key={feat.label} className="flex items-start gap-2.5 text-[#fafaf9]">
                    <IconCheck className="h-4 w-4 shrink-0 text-[#d4af37] mt-0.5" />
                    <span>{feat.label}</span>
                  </li>
                ))}
              </ul>
            </div>
            <a
              href="mailto:contato@juridico-ia.com.br?subject=Plano%20Firm%20-%20Jurídico%20IA"
              className="mt-8 block rounded-sm border border-white/[0.15] bg-white/[0.03] py-3 text-center text-xs font-semibold text-[#fafaf9] hover:border-[#d4af37]/50 hover:bg-white/[0.08] transition-all"
            >
              Falar com Especialista
            </a>
          </div>
        </div>

        {/* Micro-guarantee */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-[#a1a1aa]">
          <span className="flex items-center gap-1.5">
            <IconLockSecure className="h-3.5 w-3.5 text-[#d4af37]" />
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
