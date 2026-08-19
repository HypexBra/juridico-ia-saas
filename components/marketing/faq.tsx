"use client";

import { useState } from "react";
import { IconPlus } from "./icons";

interface FaqEntry {
  question: string;
  answer: string;
}

const FAQ_ENTRIES: FaqEntry[] = [
  {
    question: "A IA inventa artigos de lei ou jurisprudência?",
    answer:
      "Não. O sistema é instruído a nunca inventar leis, súmulas ou precedentes. Quando não há certeza sobre um ponto, ele sinaliza isso claramente em vez de preencher a lacuna com algo inventado.",
  },
  {
    question: "As peças geradas substituem a revisão do advogado?",
    answer:
      "Não. O Jurídico IA produz a minuta e a fundamentação, mas a responsabilidade pela revisão, pelos ajustes e pela assinatura continua sendo do advogado — como acontece com qualquer associado.",
  },
  {
    question: "O plano Free tem limite de uso de IA?",
    answer:
      "Sim. O Free inclui um limite mensal de uso de IA suficiente para testar o produto no dia a dia. O plano Pro, ainda em construção, trará um limite ampliado para escritórios com maior volume.",
  },
  {
    question: "Consigo exportar as peças em Word ou PDF?",
    answer:
      "Sim. Qualquer petição, contrato ou parecer gerado no chat pode ser exportado em DOCX ou PDF, já formatado, direto do painel.",
  },
  {
    question: "Consigo convidar outros advogados do escritório?",
    answer:
      "O convite de múltiplos advogados para o mesmo escritório é uma funcionalidade do plano Pro, que está em fase de lista de espera no momento.",
  },
  {
    question: "Meus dados e os dos meus clientes ficam seguros?",
    answer:
      "Sim. Cada escritório opera em um ambiente isolado (multi-tenant) e os dados de casos e clientes não são usados para treinar modelos de IA de terceiros.",
  },
];

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <div className="mb-14 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-silver">
            Dúvidas
          </p>
          <h2 className="font-display text-3xl font-bold leading-tight text-ice sm:text-4xl">
            Perguntas frequentes
          </h2>
        </div>

        <div className="divide-y divide-silver/10 overflow-hidden rounded-md border border-silver/10">
          {FAQ_ENTRIES.map((entry, index) => {
            const isOpen = openIndex === index;
            return (
              <div key={entry.question} className="bg-navy-2">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium text-ice transition-colors hover:text-silver-2 sm:px-6 sm:text-base"
                >
                  {entry.question}
                  <IconPlus
                    className={`h-4 w-4 shrink-0 text-silver transition-transform duration-300 ${
                      isOpen ? "rotate-45" : ""
                    }`}
                  />
                </button>
                <div
                  className={`grid overflow-hidden px-5 text-sm leading-relaxed text-muted transition-all duration-300 sm:px-6 ${
                    isOpen ? "grid-rows-[1fr] pb-5 opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                  style={{ display: "grid" }}
                >
                  <div className="overflow-hidden">{entry.answer}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
