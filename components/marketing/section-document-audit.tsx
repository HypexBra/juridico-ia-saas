"use client";

import { useState } from "react";
import { Reveal } from "./reveal";
import { IconCheck, IconFileAudit, IconFileText } from "./icons";

interface MarginNote {
  id: string;
  type: "relevante" | "inconsistencia" | "prazo";
  title: string;
  detail: string;
  clauseRef: string;
  originalText: string;
  suggestedText: string;
  legalBase: string;
}

const MARGIN_NOTES: MarginNote[] = [
  {
    id: "note-1",
    type: "inconsistencia",
    title: "Cláusula Penal Abusiva (25%)",
    detail: "Fixação de retenção de 25% sem previsão de reciprocidade, violando o equilíbrio contratual do CDC.",
    clauseRef: "Cláusula 8ª, Parágrafo Segundo",
    originalText: "A PROMITENTE VENDEDORA reterá 25% do valor total pago a título de multa compensatória irretratável.",
    suggestedText: "A retenção fica limitada ao patamar de 10%, com restituição imediata do saldo corrigido com juros moratórios.",
    legalBase: "Tema 971 / STJ & Súmula 543 / STJ",
  },
  {
    id: "note-2",
    type: "relevante",
    title: "Prazo de Tolerância de 180 Dias",
    detail: "Tolerância contratual expirada em 14/07/2025. Caracterizada mora injustificada da construtora.",
    clauseRef: "Cláusula 7ª, Caput",
    originalText: "Fica pactuado o prazo de tolerância suplementar de até 180 (cento e oitenta) dias corridos para entrega física.",
    suggestedText: "Decorrido o prazo improrrogável em 14/07/2025, incidem juros compensatórios e lucros cessantes presumidos.",
    legalBase: "Tema 996 / STJ (Fixação de lucros cessantes)",
  },
  {
    id: "note-3",
    type: "prazo",
    title: "Notificação Prévia Exigida",
    detail: "Necessidade de notificação formal com prazo de 15 dias antes da propositura da rescisão judicial.",
    clauseRef: "Cláusula 12ª, Caput",
    originalText: "A rescisão dependerá de prévia notificação extrajudicial com prazo de 15 dias para purga da mora.",
    suggestedText: "Notificação extrajudicial já encaminhada via Cartório de RTD sob o nº 491.029, suprindo o requisito.",
    legalBase: "Decreto-Lei nº 745/69",
  },
];

export function SectionDocumentAudit() {
  const [activeNote, setActiveNote] = useState<MarginNote>(MARGIN_NOTES[0]);
  const [applied, setApplied] = useState(false);

  const handleSelect = (note: MarginNote) => {
    setActiveNote(note);
    setApplied(false);
  };

  return (
    <section id="redline" className="relative overflow-hidden border-t border-white/[0.08] bg-[#0c0c0f] py-28 sm:py-36">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-3xl">
          <Reveal>
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
              04 · Auditoria & Redline Ativo
            </span>
          </Reveal>
          <Reveal delayMs={100}>
            <h2 className="mt-4 font-display text-4xl font-bold leading-tight text-[#fafaf9] sm:text-5xl lg:text-6xl">
              Cada documento lido como se fosse <br />
              <span className="font-normal italic text-[#d4af37]">
                o mais importante do escritório.
              </span>
            </h2>
          </Reveal>
          <Reveal delayMs={200}>
            <p className="mt-6 text-base leading-relaxed text-[#a1a1aa] sm:text-lg">
              Envie contratos e laudos com centenas de páginas.
              O sistema extrai cláusulas críticas, detecta contradições ocultas e permite aplicar correções jurisprudenciais instantâneas.
            </p>
          </Reveal>
        </div>

        {/* Editorial Document Inspector */}
        <div className="mt-16 grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-start">
          {/* Document Sheet Simulation */}
          <div className="rounded-xl border border-white/[0.1] bg-[#121216] p-6 sm:p-8 shadow-[0_24px_70px_rgba(0,0,0,0.7)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 text-xs">
                <div className="flex items-center gap-2.5">
                  <IconFileText className="h-4 w-4 text-[#d4af37]" />
                  <span className="font-mono text-[#fafaf9] font-medium">CONTRATO_PROMESSA_COMPRA_E_VENDA.PDF</span>
                </div>
                <span className="font-mono text-[10px] text-[#a1a1aa]">FLS. 08 DE 32</span>
              </div>

              {/* Active Selected Clause Interactive View */}
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase text-[#d4af37] font-semibold">
                    {activeNote.clauseRef}
                  </span>
                  <button
                    type="button"
                    onClick={() => setApplied(!applied)}
                    className="rounded border border-[#d4af37] bg-[#d4af37]/15 px-3 py-1 font-mono text-[10px] font-bold text-[#d4af37] hover:bg-[#d4af37]/25 transition-all"
                  >
                    {applied ? "Reverter Original" : "Aplicar Redline Jurisprudencial"}
                  </button>
                </div>

                <div className="rounded-lg border border-white/[0.08] bg-[#0c0c0f] p-5 font-serif text-xs sm:text-sm leading-relaxed text-[#fafaf9]">
                  {applied ? (
                    <div>
                      <p className="line-through text-red-400/70 mb-2">
                        &ldquo;{activeNote.originalText}&rdquo;
                      </p>
                      <p className="text-[#10b981] bg-[#10b981]/10 p-3 rounded border border-[#10b981]/30 font-sans text-xs">
                        <strong>✓ Redline Corrigido:</strong> &ldquo;{activeNote.suggestedText}&rdquo;
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="italic text-[#fafaf9]">
                        &ldquo;{activeNote.originalText}&rdquo;
                      </p>
                      <div className="mt-3 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 font-sans">
                        <span className="font-bold font-mono text-[10px] uppercase block mb-1">
                          [!] APONTAMENTO DE CONFORMIDADE:
                        </span>
                        {activeNote.detail}
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded border border-white/[0.05] bg-[#09090b] p-3 flex items-center justify-between text-xs text-[#a1a1aa] font-mono">
                  <span>FUNDAMENTO VINCULANTE:</span>
                  <span className="text-[#d4af37] font-semibold">{activeNote.legalBase}</span>
                </div>
              </div>
            </div>

            {/* Badges */}
            <div className="mt-8 flex flex-wrap gap-2 border-t border-white/[0.08] pt-4 text-[11px] font-mono">
              <span className="rounded bg-[#d4af37]/10 px-3 py-1 text-[#d4af37] border border-[#d4af37]/30">
                3 Pontos Relevantes
              </span>
              <span className="rounded bg-amber-500/10 px-3 py-1 text-amber-300 border border-amber-500/30">
                2 Inconsistências
              </span>
              <span className="rounded bg-[#10b981]/10 px-3 py-1 text-[#10b981] border border-[#10b981]/30">
                1 Prazo Processual
              </span>
            </div>
          </div>

          {/* Margin Notes List */}
          <div className="space-y-3">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#d4af37]">
              CLIQUE PARA INSPECIONAR OUTRAS CLÁUSULAS:
            </p>
            {MARGIN_NOTES.map((note) => {
              const isSelected = activeNote.id === note.id;
              return (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => handleSelect(note)}
                  className={`w-full rounded-xl border p-5 text-left transition-all ${
                    isSelected
                      ? "border-[#d4af37] bg-[#18181f] shadow-[0_8px_30px_rgba(212,175,55,0.15)]"
                      : "border-white/[0.08] bg-[#121216] hover:border-white/[0.18] hover:bg-[#18181f]"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-mono text-[10px] uppercase text-[#d4af37] tracking-wider">
                      {note.clauseRef}
                    </span>
                    <span
                      className={`font-mono text-[9px] uppercase px-2 py-0.5 rounded ${
                        note.type === "inconsistencia"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : note.type === "prazo"
                          ? "bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30"
                          : "bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/30"
                      }`}
                    >
                      {note.type}
                    </span>
                  </div>
                  <h4 className="font-display text-base font-bold text-[#fafaf9]">{note.title}</h4>
                  <p className="mt-2 text-xs leading-relaxed text-[#a1a1aa]">{note.detail}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
