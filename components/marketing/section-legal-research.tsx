"use client";

import { useState } from "react";
import { Reveal } from "./reveal";
import { IconCheck, IconSearchFilter } from "./icons";

const RESEARCH_CATEGORIES = [
  {
    id: "jurisprudencia",
    label: "STJ & Tribunais Superiores",
    result: {
      tribunal: "SUPERIOR TRIBUNAL DE JUSTIÇA · 3ª TURMA",
      acordao: "REsp 1.942.810/RS · Rel. Min. Nancy Andrighi · Julgado em 12/11/2025",
      ementa:
        "RECURSO ESPECIAL. DIREITO DO CONSUMIDOR. COBRANÇA INDEVIDA DE DÉBITO INEXISTENTE. REPETIÇÃO DE INDÉBITO EM DOBRO. DESNECESSIDADE DE PROVA DE MÁ-FÉ. TEMA 929/STJ. DANO MORAL IN RE IPSA CONFIGURADO.",
      aplicabilidade: "Tese idêntica à sustentada na minuta do Caso #0241.",
    },
  },
  {
    id: "legislacao",
    label: "Legislação Aplicável",
    result: {
      tribunal: "CÓDIGO DE DEFESA DO CONSUMIDOR & CÓDIGO CIVIL",
      acordao: "Art. 42, Parágrafo Único (CDC) c/c Art. 940 (Código Civil)",
      ementa:
        "O consumidor cobrado em quantia indevida tem direito à repetição do indébito, por valor igual ao dobro do que pagou em excesso, acrescido de correção monetária e juros legais, salvo hipótese de engano justificável.",
      aplicabilidade: "Base legal para o Pedido Principal de Devolução em Dobro.",
    },
  },
  {
    id: "precedentes-locais",
    label: "Tribunais Estaduais (TJSP / TJRJ / TJRS)",
    result: {
      tribunal: "TRIBUNAL DE JUSTIÇA DO RS · 18ª CÂMARA CÍVEL",
      acordao: "Apelação Cível nº 5019842-14.2025.8.21.0001 · Publicado no DJEN em 10/02/2026",
      ementa:
        "AÇÃO DECLARATÓRIA DE INEXISTÊNCIA DE DÉBITO C/C REPARAÇÃO POR DANOS MORAIS. INSCRIÇÃO INDEVIDA NOS CADASTROS DE PROTEÇÃO AO CRÉDITO. QUANTUM INDENIZATÓRIO MANTIDO EM R$ 15.000,00.",
      aplicabilidade: "Parâmetro quantitativo exato para estimativa do valor da causa.",
    },
  },
];

export function SectionLegalResearch() {
  const [selectedCat, setSelectedCat] = useState("jurisprudencia");
  const current = RESEARCH_CATEGORIES.find((c) => c.id === selectedCat) ?? RESEARCH_CATEGORIES[0];

  return (
    <section className="relative overflow-hidden border-t border-white/[0.08] bg-[#09090b] py-28 sm:py-36">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-3xl">
          <Reveal>
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
              09 · Pesquisa Jurídica Verificável
            </span>
          </Reveal>
          <Reveal delayMs={100}>
            <h2 className="mt-4 font-display text-4xl font-bold leading-tight text-[#fafaf9] sm:text-5xl lg:text-6xl">
              Pesquisa com fonte, acórdão e <br />
              <span className="font-normal italic text-[#d4af37]">
                tribunal verificáveis.
              </span>
            </h2>
          </Reveal>
          <Reveal delayMs={200}>
            <p className="mt-6 text-base leading-relaxed text-[#a1a1aa] sm:text-lg">
              Nada de citações fantasmas ou jurisprudência inventada.
              Cada precedente é auditado diretamente nas bases oficiais com número de processo, relator e data de julgamento.
            </p>
          </Reveal>
        </div>

        {/* Search Engine Console */}
        <div className="mt-16 overflow-hidden rounded-xl border border-white/[0.1] bg-[#121216] shadow-[0_24px_70px_rgba(0,0,0,0.75)]">
          {/* Query Bar */}
          <div className="border-b border-white/[0.08] bg-[#0c0c0f] p-5">
            <div className="flex items-center gap-3.5 rounded-lg border border-white/[0.1] bg-[#09090b] px-4 py-3 text-xs sm:text-sm">
              <IconSearchFilter className="h-4 w-4 text-[#d4af37] shrink-0" />
              <span className="font-mono text-[#fafaf9] truncate">
                &ldquo;responsabilidade civil por cobrança indevida e repetição em dobro&rdquo;
              </span>
              <span className="ml-auto font-mono text-[10px] text-[#10b981] bg-[#10b981]/10 px-2.5 py-0.5 rounded border border-[#10b981]/30 hidden sm:inline-block">
                FONTE STJ AUDITADA
              </span>
            </div>
          </div>

          {/* Results Area */}
          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr]">
            {/* Filter Column */}
            <div className="flex flex-row overflow-x-auto lg:flex-col border-b lg:border-b-0 lg:border-r border-white/[0.08] bg-[#0a0a0d] p-3 gap-1.5">
              {RESEARCH_CATEGORIES.map((cat) => {
                const isSelected = selectedCat === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCat(cat.id)}
                    className={`rounded-md p-3.5 text-left text-xs font-semibold transition-all whitespace-nowrap lg:whitespace-normal ${
                      isSelected
                        ? "bg-[#18181f] text-[#d4af37] border border-[#d4af37]/40 shadow-[0_0_12px_rgba(212,175,55,0.1)]"
                        : "text-[#a1a1aa] hover:text-[#fafaf9] hover:bg-white/[0.02]"
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {/* Precedent Inspection View */}
            <div className="p-6 sm:p-8 space-y-5 bg-[#121216]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-4">
                <span className="font-mono text-xs font-bold text-[#d4af37] uppercase">
                  {current.result.tribunal}
                </span>
                <span className="font-mono text-[11px] text-[#fafaf9]/80">
                  {current.result.acordao}
                </span>
              </div>

              <div className="rounded-lg border border-white/[0.08] bg-[#0c0c0f] p-5 font-serif text-xs sm:text-sm leading-relaxed text-[#fafaf9] italic">
                &ldquo;{current.result.ementa}&rdquo;
              </div>

              <div className="flex items-center gap-2.5 text-xs font-mono text-[#10b981] pt-2">
                <IconCheck className="h-4 w-4" />
                <span>{current.result.aplicabilidade}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
