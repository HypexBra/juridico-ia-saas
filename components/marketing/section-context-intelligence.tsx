"use client";

import { useState } from "react";
import { Reveal } from "./reveal";
import { IconCheck, IconSearchFilter } from "./icons";

const PROMPT_EXAMPLES = [
  {
    question: "Qual o risco da preliminar de incompetência territorial da ré?",
    answer:
      "Risco baixo. Conforme o Contrato anexado (fls. 14, Cláusula 18), há foro de eleição em São Paulo. Contudo, tratando-se de relação de consumo com hipossuficiência técnica comprovada, incide a Súmula 335 do STF c/c art. 101, I, do CDC, fixando a competência no domicílio da autora (Porto Alegre/RS).",
    citations: ["CDC Art. 101, I", "STF Súmula 335", "Contrato Cl. 18"],
  },
  {
    question: "O atraso de 180 dias da construtora ultrapassa o prazo de tolerância?",
    answer:
      "Sim. A cláusula 7.1 previa tolerância de até 180 dias corridos contados de 15/01/2025. O termo final ocorreu em 14/07/2025. A expedição do Habite-se ocorreu apenas em 20/01/2026 (190 dias de mora injustificada), autorizando a rescisão por culpa exclusiva e incidência do Tema 971 do STJ.",
    citations: ["STJ Tema 971", "Contrato Cl. 7.1", "Habite-se de 20.01.2026"],
  },
];

export function SectionContextIntelligence() {
  const [selectedPrompt, setSelectedPrompt] = useState(0);
  const activeItem = PROMPT_EXAMPLES[selectedPrompt];

  return (
    <section className="relative overflow-hidden border-t border-white/[0.08] bg-[#09090b] py-28 sm:py-36">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-3xl">
          <Reveal>
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
              03 · Inteligência Contextual
            </span>
          </Reveal>
          <Reveal delayMs={100}>
            <h2 className="mt-4 font-display text-4xl font-bold leading-tight text-[#fafaf9] sm:text-5xl lg:text-6xl">
              A inteligência não começa pela resposta. <br />
              <span className="font-normal italic text-[#d4af37]">
                Começa pelo contexto.
              </span>
            </h2>
          </Reveal>
          <Reveal delayMs={200}>
            <p className="mt-6 text-base leading-relaxed text-[#a1a1aa] sm:text-lg">
              Um modelo de linguagem genérico não sabe nada sobre os autos do seu cliente.
              O Jurídico OS cruza contratos, peças anteriores, despachos e súmulas antes de redigir qualquer linha.
            </p>
          </Reveal>
        </div>

        {/* Context Matrix Visual */}
        <div className="mt-16 overflow-hidden rounded-xl border border-white/[0.1] bg-[#121216] shadow-[0_24px_70px_rgba(0,0,0,0.75)]">
          {/* Top Context Breadcrumb */}
          <div className="border-b border-white/[0.08] bg-[#0c0c0f] px-6 py-4">
            <div className="flex flex-wrap items-center gap-2.5 font-mono text-[11px] text-[#a1a1aa]">
              <span className="text-[#d4af37] uppercase font-semibold">Contexto Carregado:</span>
              <span className="rounded bg-[#d4af37]/10 px-2.5 py-1 text-[#d4af37] border border-[#d4af37]/30">Autos nº 5002931</span>
              <span>+</span>
              <span className="rounded bg-white/[0.05] px-2.5 py-1 text-[#fafaf9] border border-white/[0.1]">Contrato Imobiliário</span>
              <span>+</span>
              <span className="rounded bg-[#d4af37]/10 px-2.5 py-1 text-[#d4af37] border border-[#d4af37]/30">Jurisprudência STJ</span>
              <span>+</span>
              <span className="rounded bg-white/[0.05] px-2.5 py-1 text-[#fafaf9] border border-white/[0.1]">Histórico do Juízo</span>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            {/* Interactive Questions */}
            <div className="space-y-3">
              <p className="font-mono text-[10px] uppercase tracking-wider text-[#d4af37] font-semibold">
                SELECIONE UM CENÁRIO DE CONSULTA REAL:
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {PROMPT_EXAMPLES.map((item, idx) => (
                  <button
                    key={item.question}
                    type="button"
                    onClick={() => setSelectedPrompt(idx)}
                    className={`rounded-lg border p-4 text-left text-xs font-medium transition-all ${
                      selectedPrompt === idx
                        ? "border-[#d4af37] bg-[#18181f] text-[#fafaf9] shadow-[0_0_20px_rgba(212,175,55,0.15)]"
                        : "border-white/[0.08] bg-[#0c0c0f] text-[#a1a1aa] hover:border-white/[0.18] hover:text-[#fafaf9]"
                    }`}
                  >
                    <span className="font-mono text-[10px] text-[#d4af37] block mb-1">
                      CENÁRIO 0{idx + 1}
                    </span>
                    &ldquo;{item.question}&rdquo;
                  </button>
                ))}
              </div>
            </div>

            {/* Answer Display */}
            <div className="mt-6 rounded-lg border border-white/[0.08] bg-[#09090b] p-6 sm:p-7 space-y-4">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <span className="font-mono text-[11px] font-semibold text-[#d4af37] uppercase flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#10b981]" />
                  Fundamentação Extraída Diretamente dos Autos
                </span>
                <span className="font-mono text-[10px] text-[#10b981] bg-[#10b981]/10 px-2.5 py-0.5 rounded border border-[#10b981]/30">
                  0 ALUCINAÇÕES
                </span>
              </div>
              <p className="text-xs sm:text-sm leading-relaxed text-[#fafaf9]">
                {activeItem.answer}
              </p>
              <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.08] pt-4">
                <span className="font-mono text-[10px] uppercase text-[#a1a1aa]">
                  FONTES AUDITADAS:
                </span>
                {activeItem.citations.map((cite) => (
                  <span
                    key={cite}
                    className="inline-flex items-center gap-1.5 font-mono text-[10px] text-[#d4af37] bg-[#d4af37]/10 px-3 py-1 rounded border border-[#d4af37]/30"
                  >
                    <IconCheck className="h-3 w-3 text-[#10b981]" />
                    {cite}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
