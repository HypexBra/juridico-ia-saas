"use client";

import { useState } from "react";
import { Reveal } from "./reveal";
import { IconPlus } from "./icons";

interface FaqEntry {
  question: string;
  answer: string;
}

const FAQ_ENTRIES: FaqEntry[] = [
  {
    question: "O sistema inventa artigos de lei, acórdãos ou súmulas?",
    answer:
      "Não. O Jurídico OS foi desenhado com restrição estrita contra alucinações jurídicas. Quando não houver certeza probatória ou precedente consolidado sobre uma tese, o sistema sinaliza a lacuna para o advogado em vez de preenchê-la com dados inventados.",
  },
  {
    question: "A inteligência artificial substitui a revisão e assinatura do advogado?",
    answer:
      "Nunca. O Jurídico OS atua como um associado sênior incansável que organiza o contexto, redige minutas e audita a coerência técnica. A responsabilidade técnica, a decisão estratégica e a assinatura da peça continuam sob o controle soberano do advogado.",
  },
  {
    question: "Como funciona o monitoramento diário de prazos no DJEN?",
    answer:
      "O sistema realiza varreduras periódicas nos diários oficiais vinculados aos processos cadastrados no seu escritório, identifica intimações de despacho e sentença, calcula o prazo fatal em dias úteis (descontando feriados forenses locais) e adiciona o evento à sua pauta de prioridades.",
  },
  {
    question: "Consigo exportar as peças diretamente para Word (DOCX) e PDF?",
    answer:
      "Sim. Todas as peças, contratos, pareceres e relatórios gerados podem ser exportados em formato DOCX (Word editável) ou PDF de alta resolução, já diagramados e prontos para assinatura e protocolo.",
  },
  {
    question: "Meus documentos ou teses são usados para treinar modelos públicos de IA?",
    answer:
      "Não. Seus arquivos, nomes de clientes, estratégias e documentos permanecem confidenciais em um cofre de dados segregado por escritório (multi-tenant) e nunca são compartilhados ou utilizados para treinamento de modelos de terceiros.",
  },
  {
    question: "Existe fidelidade ou carência no plano Pro?",
    answer:
      "Nenhuma fidelidade. Você pode assinar o plano Pro para automatizar seus prazos e atendimento e cancelar a qualquer momento diretamente no seu painel com apenas um clique.",
  },
];

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="relative overflow-hidden border-t border-white/[0.08] bg-[#0c0c0f] py-28 sm:py-36">
      <div className="mx-auto max-w-4xl px-5 sm:px-8">
        <div className="max-w-3xl">
          <Reveal>
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
              16 · Perguntas Frequentes
            </span>
          </Reveal>
          <Reveal delayMs={100}>
            <h2 className="mt-4 font-display text-4xl font-bold leading-tight text-[#fafaf9] sm:text-5xl lg:text-6xl">
              Respostas diretas para <br />
              <span className="font-normal italic text-[#d4af37]">
                quem valoriza precisão.
              </span>
            </h2>
          </Reveal>
        </div>

        {/* Accordion */}
        <div className="mt-16 divide-y divide-white/[0.08] overflow-hidden rounded-xl border border-white/[0.1] bg-[#121216]">
          {FAQ_ENTRIES.map((entry, index) => {
            const isOpen = openIndex === index;
            return (
              <div key={entry.question} className="transition-colors">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="flex w-full items-center justify-between gap-4 p-6 text-left text-xs sm:text-sm font-semibold text-[#fafaf9] transition-colors hover:text-[#d4af37]"
                >
                  <span>{entry.question}</span>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-white/[0.1] bg-[#0c0c0f] text-[#d4af37]">
                    <IconPlus
                      className={`h-3.5 w-3.5 transition-transform duration-200 ${
                        isOpen ? "rotate-45" : ""
                      }`}
                    />
                  </span>
                </button>
                {isOpen && (
                  <div className="px-6 pb-6 text-xs sm:text-sm leading-relaxed text-[#a1a1aa] border-t border-white/[0.04] pt-3">
                    {entry.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
