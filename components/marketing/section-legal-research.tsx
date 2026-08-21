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
    <section className="relative overflow-hidden border-t border-silver/10 bg-[#080e18] py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <Reveal>
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-silver">
              09 · Pesquisa Jurídica Verificável
            </span>
          </Reveal>
          <Reveal delayMs={100}>
            <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-ice sm:text-4xl lg:text-5xl">
              Pesquisa com fonte, acórdão e <br />
              <span className="font-normal italic text-silver-2">
                tribunal verificáveis.
              </span>
            </h2>
          </Reveal>
          <Reveal delayMs={200}>
            <p className="mt-5 text-base leading-relaxed text-muted sm:text-lg">
              Nada de citações fantasmas ou jurisprudência inventada.
              Cada precedente é auditado diretamente nas bases dos tribunais com número de processo, relator e data de julgamento.
            </p>
          </Reveal>
        </div>

        {/* Search Engine Mockup */}
        <div className="mt-14 overflow-hidden rounded-md border border-silver/20 bg-[#0b1322] shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          {/* Query Bar */}
          <div className="border-b border-silver/10 bg-black/40 p-4 sm:p-5">
            <div className="flex items-center gap-3 rounded-sm border border-silver/20 bg-black/40 px-4 py-3 text-xs sm:text-sm">
              <IconSearchFilter className="h-4 w-4 text-silver shrink-0" />
              <span className="font-mono text-ice-2 truncate">
                &ldquo;responsabilidade civil por cobrança indevida e repetição em dobro&rdquo;
              </span>
              <span className="ml-auto font-mono text-[10px] text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20 hidden sm:inline-block">
                FONTE STJ AUDITADA
              </span>
            </div>
          </div>

          {/* Results Area */}
          <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] border-b border-silver/10">
            {/* Filter Column */}
            <div className="flex flex-row overflow-x-auto lg:flex-col border-b lg:border-b-0 lg:border-r border-silver/10 bg-black/20 p-2 gap-1">
              {RESEARCH_CATEGORIES.map((cat) => {
                const isSelected = selectedCat === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCat(cat.id)}
                    className={`rounded-sm p-3 text-left text-xs font-medium transition-colors whitespace-nowrap lg:whitespace-normal ${
                      isSelected
                        ? "bg-silver/15 text-ice border border-silver/30"
                        : "text-muted hover:text-ice-2 hover:bg-white/[0.02]"
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {/* Precedent Inspection View */}
            <div className="p-6 sm:p-8 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-silver/10 pb-3">
                <span className="font-mono text-xs font-bold text-silver uppercase">
                  {current.result.tribunal}
                </span>
                <span className="font-mono text-[11px] text-silver-2">
                  {current.result.acordao}
                </span>
              </div>

              <div className="rounded-sm border border-silver/15 bg-black/30 p-4 font-serif text-xs sm:text-sm leading-relaxed text-ice-2/90 italic">
                &ldquo;{current.result.ementa}&rdquo;
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 pt-2">
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
