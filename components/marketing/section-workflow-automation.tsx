"use client";

import { useState } from "react";
import { Reveal } from "./reveal";
import { IconCheck, IconWorkflow } from "./icons";

const WORKFLOW_STEPS = [
  {
    step: "01",
    title: "Triagem Pública do Cliente",
    desc: "O cliente preenche o link do escritório; a IA organiza os fatos, documentos iniciais e extrai a narrativa jurídica.",
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
    <section id="automacao" className="relative overflow-hidden border-t border-silver/10 bg-[#080d17] py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <Reveal>
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-silver">
              07 · Automação de Ponta a Ponta
            </span>
          </Reveal>
          <Reveal delayMs={100}>
            <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-ice sm:text-4xl lg:text-5xl">
              O trabalho que você não precisa <br />
              <span className="font-normal italic text-silver-2">
                mais lembrar de fazer.
              </span>
            </h2>
          </Reveal>
          <Reveal delayMs={200}>
            <p className="mt-5 text-base leading-relaxed text-muted sm:text-lg">
              Desde a primeira mensagem do cliente até o monitoramento do trânsito em julgado,
              o fluxo operacional avança de forma contínua e previsível.
            </p>
          </Reveal>
        </div>

        {/* Workflow Timeline Interactive Pipeline */}
        <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {WORKFLOW_STEPS.map((item, idx) => {
            const isCurrent = activeStep === idx;
            return (
              <div
                key={item.step}
                onClick={() => setActiveStep(idx)}
                className={`cursor-pointer rounded-md border p-6 transition-all duration-200 ${
                  isCurrent
                    ? "border-silver bg-[#0d1626] shadow-[0_8px_30px_rgba(199,210,232,0.1)] -translate-y-1"
                    : "border-silver/15 bg-navy-2/20 hover:border-silver/30 hover:bg-navy-2/30"
                }`}
              >
                <div className="flex items-center justify-between border-b border-silver/10 pb-3">
                  <span className="font-mono text-xs font-bold text-silver">
                    FASE {item.step}
                  </span>
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isCurrent ? "bg-emerald-400 animate-pulse" : "bg-silver/30"
                    }`}
                  />
                </div>
                <h3 className="mt-4 font-display text-base font-bold text-ice">{item.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted">{item.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Workflow Bottom Assurance */}
        <div className="mt-10 rounded-sm border border-silver/10 bg-black/25 p-5 text-center text-xs text-muted">
          <p className="flex items-center justify-center gap-2">
            <IconWorkflow className="h-4 w-4 text-silver" />
            <span>Nenhum passo é executado no escuro: você recebe notificações discretas de cada avanço do caso.</span>
          </p>
        </div>
      </div>
    </section>
  );
}
