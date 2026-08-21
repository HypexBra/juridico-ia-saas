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
}

const MARGIN_NOTES: MarginNote[] = [
  {
    id: "note-1",
    type: "relevante",
    title: "Cláusula Penal Compensatória",
    detail: "Prevê retenção de 25% em caso de rescisão — percentual passível de redução para 10% pelo Tema 971 do STJ.",
    clauseRef: "Cláusula 8ª, Parágrafo Segundo",
  },
  {
    id: "note-2",
    type: "inconsistencia",
    title: "Conflito de Prazos de Entrega",
    detail: "O preâmbulo cita 24 meses enquanto o Anexo B estipula 36 meses, gerando vício de informação (CDC art. 6º, III).",
    clauseRef: "Preâmbulo vs. Anexo B",
  },
  {
    id: "note-3",
    type: "prazo",
    title: "Notificação de Mora Requerida",
    detail: "Exige interpelação prévia com prazo de 15 dias para purga da mora antes da propositura da ação rescisória.",
    clauseRef: "Cláusula 12ª, Caput",
  },
];

export function SectionDocumentAudit() {
  const [activeNote, setActiveNote] = useState<string>("note-1");

  return (
    <section id="documentos" className="relative overflow-hidden border-t border-silver/10 bg-[#09101d] py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <Reveal>
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-silver">
              04 · Auditoria Ativa de Documentos
            </span>
          </Reveal>
          <Reveal delayMs={100}>
            <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-ice sm:text-4xl lg:text-5xl">
              Cada documento lido como se fosse <br />
              <span className="font-normal italic text-silver-2">
                o mais importante do escritório.
              </span>
            </h2>
          </Reveal>
          <Reveal delayMs={200}>
            <p className="mt-5 text-base leading-relaxed text-muted sm:text-lg">
              Envie contratos, laudos e decisões com centenas de páginas.
              O sistema extrai cláusulas críticas, detecta contradições ocultas e vincula precedentes automaticamente.
            </p>
          </Reveal>
        </div>

        {/* Editorial Document Inspector */}
        <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-start">
          {/* Document Sheet Simulation */}
          <div className="rounded-md border border-silver/20 bg-[#0d1728] p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
            <div className="flex items-center justify-between border-b border-silver/10 pb-4 text-xs">
              <div className="flex items-center gap-2">
                <IconFileText className="h-4 w-4 text-silver" />
                <span className="font-mono text-ice font-medium">INSTRUMENTO_PARTICULAR_PROMESSA_COMPRA.PDF</span>
              </div>
              <span className="font-mono text-[10px] text-muted">FLS. 08 DE 32</span>
            </div>

            {/* Document Body Text */}
            <div className="mt-6 space-y-4 font-serif text-xs sm:text-sm leading-relaxed text-ice-2/90">
              <p className="border-l-2 border-silver/40 pl-3 italic text-muted">
                &ldquo;CLÁUSULA OITAVA — Da Extinção Contratual e Cláusula Penal: Na hipótese de rescisão por iniciativa da PROMITENTE VENDEDORA motivada pelo inadimplemento dos prazos de entrega física da unidade autônoma...&rdquo;
              </p>
              <div className="rounded-sm border border-amber-400/30 bg-amber-400/5 p-3 font-sans text-xs">
                <span className="font-mono text-[10px] font-bold text-amber-300 uppercase block mb-1">
                  [!] PONTO CRÍTICO DETECTADO:
                </span>
                <p className="text-amber-100/90 leading-normal">
                  Parágrafo Segundo: Fixação de retenção compensatória de 25% dos valores integralizados pela compradora sem previsão de reciprocidade.
                </p>
              </div>
              <p className="text-muted/80">
                &ldquo;CLÁUSULA DÉCIMA SEGUNDA — Da Notificação e Interpelação Prévia: A resolução de pleno direito do presente pacto dependerá de prévia notificação extrajudicial com prazo de 15 (quinze) dias para purgação da mora.&rdquo;
              </p>
            </div>

            {/* Extraction Metric Badges */}
            <div className="mt-6 flex flex-wrap gap-2 border-t border-silver/10 pt-4 text-[11px] font-mono">
              <span className="rounded bg-silver/10 px-2.5 py-1 text-silver-2 border border-silver/20">
                3 Pontos Relevantes
              </span>
              <span className="rounded bg-amber-400/10 px-2.5 py-1 text-amber-300 border border-amber-400/20">
                2 Inconsistências
              </span>
              <span className="rounded bg-emerald-400/10 px-2.5 py-1 text-emerald-300 border border-emerald-400/20">
                1 Prazo Fatal
              </span>
              <span className="rounded bg-silver/10 px-2.5 py-1 text-silver-2 border border-silver/20">
                4 Precedentes Vinculados
              </span>
            </div>
          </div>

          {/* Margin Audit Notes Column */}
          <div className="space-y-3">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted">
              APONTAMENTOS DA AUDITORIA
            </p>
            {MARGIN_NOTES.map((note) => {
              const isSelected = activeNote === note.id;
              return (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => setActiveNote(note.id)}
                  className={`w-full rounded-md border p-5 text-left transition-all ${
                    isSelected
                      ? "border-silver bg-[#111e33] shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
                      : "border-silver/15 bg-navy-2/20 hover:border-silver/30 hover:bg-navy-2/40"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-mono text-[10px] uppercase text-silver tracking-wider">
                      {note.clauseRef}
                    </span>
                    <span
                      className={`font-mono text-[9px] uppercase px-2 py-0.5 rounded ${
                        note.type === "inconsistencia"
                          ? "bg-amber-400/20 text-amber-300"
                          : note.type === "prazo"
                          ? "bg-emerald-400/20 text-emerald-300"
                          : "bg-silver/20 text-silver-2"
                      }`}
                    >
                      {note.type}
                    </span>
                  </div>
                  <h4 className="font-display text-sm font-bold text-ice">{note.title}</h4>
                  <p className="mt-2 text-xs leading-relaxed text-muted">{note.detail}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
