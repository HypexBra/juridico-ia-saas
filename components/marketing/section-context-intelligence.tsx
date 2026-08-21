"use client";

import { useState } from "react";
import { Reveal } from "./reveal";
import { IconCheck, IconFileText, IconLockSecure, IconSearchFilter } from "./icons";

const PROMPT_EXAMPLES = [
  {
    question: "Qual o risco da preliminar de incompetência territorial da ré?",
    answer:
      "Risco baixo. Conforme o Contrato anexado (fls. 14, Cláusula 18), há cláusula de foro em São Paulo. Contudo, tratando-se de relação de consumo com hipossuficiência técnica comprovada, incide a Súmula 335 do STF c/c art. 101, I, do CDC, fixando a competência no domicílio da autora (Porto Alegre/RS).",
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
    <section className="relative overflow-hidden border-t border-silver/10 bg-[#080e18] py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <Reveal>
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-silver">
              03 · Inteligência Contextual
            </span>
          </Reveal>
          <Reveal delayMs={100}>
            <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-ice sm:text-4xl lg:text-5xl">
              A inteligência não começa pela resposta. <br />
              <span className="font-normal italic text-silver-2">
                Começa pelo contexto.
              </span>
            </h2>
          </Reveal>
          <Reveal delayMs={200}>
            <p className="mt-5 text-base leading-relaxed text-muted sm:text-lg">
              Um modelo de linguagem isolado não sabe nada sobre os autos do seu cliente.
              O Jurídico IA cruza contratos, peças anteriores, despachos e súmulas antes de escrever qualquer palavra.
            </p>
          </Reveal>
        </div>

        {/* Context Matrix Visual */}
        <div className="mt-14 overflow-hidden rounded-md border border-silver/20 bg-[#0b1320] shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          {/* Top Context Breadcrumb */}
          <div className="border-b border-silver/10 bg-black/30 px-5 py-3.5">
            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted">
              <span className="text-silver uppercase font-semibold">Contexto Carregado:</span>
              <span className="rounded bg-silver/10 px-2 py-0.5 text-silver-2">Autos nº 5002931</span>
              <span>+</span>
              <span className="rounded bg-silver/10 px-2 py-0.5 text-silver-2">Contrato Imobiliário</span>
              <span>+</span>
              <span className="rounded bg-silver/10 px-2 py-0.5 text-silver-2">Jurisprudência STJ</span>
              <span>+</span>
              <span className="rounded bg-silver/10 px-2 py-0.5 text-silver-2">Histórico do Juízo</span>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            {/* Interactive Questions */}
            <div className="space-y-2">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                PERGUNTE QUALQUER COISA SOBRE ESTE CASO
              </p>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {PROMPT_EXAMPLES.map((item, idx) => (
                  <button
                    key={item.question}
                    type="button"
                    onClick={() => setSelectedPrompt(idx)}
                    className={`rounded-sm border p-3.5 text-left text-xs font-medium transition-all ${
                      selectedPrompt === idx
                        ? "border-silver bg-silver/15 text-ice shadow-[0_0_12px_rgba(199,210,232,0.08)]"
                        : "border-silver/15 bg-black/20 text-muted hover:border-silver/30 hover:text-ice-2"
                    }`}
                  >
                    <span className="font-mono text-[10px] text-silver/70 block mb-1">
                      CENÁRIO 0{idx + 1}
                    </span>
                    &ldquo;{item.question}&rdquo;
                  </button>
                ))}
              </div>
            </div>

            {/* Answer Display */}
            <div className="mt-6 rounded-sm border border-silver/15 bg-black/30 p-5 sm:p-6">
              <div className="flex items-center justify-between border-b border-silver/10 pb-3">
                <span className="font-mono text-[11px] font-semibold text-silver uppercase flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Resposta Fundamentada em Provas dos Autos
                </span>
                <span className="font-mono text-[10px] text-muted">0 ALUCINAÇÕES</span>
              </div>
              <p className="mt-4 text-xs sm:text-sm leading-relaxed text-ice-2">
                {activeItem.answer}
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-silver/10 pt-4">
                <span className="font-mono text-[10px] uppercase text-muted">
                  FONTES AUDITADAS:
                </span>
                {activeItem.citations.map((cite) => (
                  <span
                    key={cite}
                    className="inline-flex items-center gap-1.5 font-mono text-[10px] text-silver-2 bg-silver/10 px-2.5 py-1 rounded border border-silver/20"
                  >
                    <IconCheck className="h-3 w-3 text-emerald-400" />
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
