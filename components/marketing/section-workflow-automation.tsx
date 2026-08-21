"use client";

import { useState } from "react";
import { Reveal } from "./reveal";
import { IconCheck, IconWorkflow } from "./icons";

const WORKFLOW_STEPS = [
  {
    step: "01",
    title: "Triagem Pública do Cliente",
    desc: "O cliente preenche o link seguro do escritório; a IA organiza os fatos, documentos iniciais e extrai a narrativa jurídica.",
  },
  {
    step: "02",
    title: "Ingestão e Leitura Documental",
    desc: "Contratos e extratos são conferidos, cláusulas abusivas são sinalizadas e cálculos preliminares são gerados.",
  },
  {
    step: "03",
    title: "Enquadramento de Tese & Jurisprudência",
    desc: "Cruzamento com precedentes vinculantes do STJ/STF e histórico de decisões do juízo competente.",
  },
  {
    step: "04",
    title: "Geração da Minuta Inicial",
    desc: "A peça é redigida com fundamentação integral, sem placeholders vazios ou modelos engessados.",
  },
  {
    step: "05",
    title: "Auditoria Pré-Assinatura",
    desc: "Verificação de coerência de pedidos, valores liquidados e tempestividade antes da assinatura do advogado.",
  },
  {
    step: "06",
    title: "Sincronização com o DJEN",
    desc: "O sistema monitora publicações diárias no diário oficial e alimenta a agenda de prazos automaticamente.",
  },
];

export function SectionWorkflowAutomation() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <section id="automacao" className="relative overflow-hidden border-t border-white/[0.08] bg-[#09090b] py-28 sm:py-36">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-3xl">
          <Reveal>
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
              07 · Automação de Ponta a Ponta
            </span>
          </Reveal>
          <Reveal delayMs={100}>
            <h2 className="mt-4 font-display text-4xl font-bold leading-tight text-[#fafaf9] sm:text-5xl lg:text-6xl">
              O trabalho que você não precisa <br />
              <span className="font-normal italic text-[#d4af37]">
                mais lembrar de fazer.
              </span>
            </h2>
          </Reveal>
          <Reveal delayMs={200}>
            <p className="mt-6 text-base leading-relaxed text-[#a1a1aa] sm:text-lg">
              Desde a primeira mensagem do cliente até o monitoramento do trânsito em julgado,
              o fluxo operacional avança de forma contínua e previsível.
            </p>
          </Reveal>
        </div>

        {/* Workflow Timeline Interactive Pipeline */}
        <div className="mt-16 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {WORKFLOW_STEPS.map((item, idx) => {
            const isCurrent = activeStep === idx;
            return (
              <div
                key={item.step}
                onClick={() => setActiveStep(idx)}
                className={`cursor-pointer rounded-xl border p-6 transition-all duration-200 ${
                  isCurrent
                    ? "border-[#d4af37] bg-[#18181f] shadow-[0_8px_30px_rgba(212,175,55,0.15)] -translate-y-1"
                    : "border-white/[0.08] bg-[#121216] hover:border-white/[0.18] hover:bg-[#18181f]"
                }`}
              >
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                  <span className="font-mono text-xs font-bold text-[#d4af37]">
                    FASE {item.step}
                  </span>
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isCurrent ? "bg-[#10b981] animate-pulse" : "bg-white/20"
                    }`}
                  />
                </div>
                <h3 className="mt-4 font-display text-base font-bold text-[#fafaf9]">{item.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-[#a1a1aa]">{item.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Workflow Bottom Assurance */}
        <div className="mt-10 rounded-lg border border-white/[0.08] bg-[#121216] p-5 text-center text-xs text-[#a1a1aa]">
          <p className="flex items-center justify-center gap-2">
            <IconWorkflow className="h-4 w-4 text-[#d4af37]" />
            <span>Nenhum passo é executado no escuro: você recebe notificações discretas de cada avanço do caso.</span>
          </p>
        </div>
      </div>
    </section>
  );
}
