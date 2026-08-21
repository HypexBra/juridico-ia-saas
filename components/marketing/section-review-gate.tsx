"use client";

import { Reveal } from "./reveal";
import { IconCheck, IconShield } from "./icons";

const AUDIT_CHECKLIST = [
  {
    criterion: "Fundamentação Fática e Jurídica",
    status: "pass",
    label: "Conforme",
    detail: "Todos os fatos narrados encontram amparo em provas documentais nos autos.",
  },
  {
    criterion: "Coerência e Liquidação dos Pedidos",
    status: "pass",
    label: "Conciliado",
    detail: "Soma das verbas calculada em R$ 142.500,00 compatível com o valor da causa.",
  },
  {
    criterion: "Precedentes e Súmulas Vinculantes",
    status: "pass",
    label: "Verificado",
    detail: "Tema 971 do STJ e Súmula 543 citados com acórdãos vigentes de 2025/2026.",
  },
  {
    criterion: "Tempestividade e Contagem Processual",
    status: "pass",
    label: "Em Prazo",
    detail: "Protocolo previsto para 4 dias úteis antes do termo final do DJEN.",
  },
  {
    criterion: "Alerta de Contradição Recursal",
    status: "warning",
    label: "Ajustado",
    detail: "Substituição do pedido subsidiário incompatível com o rito ordinário.",
  },
];

export function SectionReviewGate() {
  return (
    <section className="relative overflow-hidden border-t border-white/[0.08] bg-[#09090b] py-28 sm:py-36">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-3xl">
          <Reveal>
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
              05 · A Auditoria Pré-Assinatura
            </span>
          </Reveal>
          <Reveal delayMs={100}>
            <h2 className="mt-4 font-display text-4xl font-bold leading-tight text-[#fafaf9] sm:text-5xl lg:text-6xl">
              Antes de você assinar, <br />
              <span className="font-normal italic text-[#d4af37]">
                ela lê de novo.
              </span>
            </h2>
          </Reveal>
          <Reveal delayMs={200}>
            <p className="mt-6 text-base leading-relaxed text-[#a1a1aa] sm:text-lg">
              Um erro em um artigo ou em uma soma pode custar a admissibilidade do recurso.
              O sistema atua como uma segunda camada de revisão técnica para blindar sua peça.
            </p>
          </Reveal>
        </div>

        {/* Audit Gate Card */}
        <div className="mt-16 overflow-hidden rounded-xl border border-white/[0.1] bg-[#121216] shadow-[0_24px_70px_rgba(0,0,0,0.75)]">
          <div className="flex flex-wrap items-center justify-between border-b border-white/[0.08] bg-[#0c0c0f] px-6 py-5">
            <div className="flex items-center gap-3.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-sm border border-[#10b981]/40 bg-[#10b981]/10 text-[#10b981]">
                <IconCheck className="h-4 w-4" />
              </span>
              <div>
                <h3 className="font-display text-base font-bold text-[#fafaf9]">
                  Relatório de Auditoria de Peça Processual
                </h3>
                <p className="font-mono text-[10px] text-[#a1a1aa]">PETIÇÃO_INICIAL_RESCISAO_vFINAL.DOCX</p>
              </div>
            </div>
            <span className="font-mono text-xs text-[#10b981] bg-[#10b981]/10 px-3 py-1 rounded border border-[#10b981]/30">
              HABILITADA PARA PROTOCOLO
            </span>
          </div>

          <div className="divide-y divide-white/[0.06]">
            {AUDIT_CHECKLIST.map((item, idx) => (
              <div
                key={item.criterion}
                className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-start gap-4">
                  <span className="font-mono text-xs text-[#d4af37] pt-0.5">0{idx + 1}</span>
                  <div>
                    <h4 className="text-xs sm:text-sm font-semibold text-[#fafaf9]">{item.criterion}</h4>
                    <p className="text-[11px] sm:text-xs text-[#a1a1aa] mt-0.5 leading-relaxed">{item.detail}</p>
                  </div>
                </div>
                <span
                  className={`self-start sm:self-auto font-mono text-[11px] font-medium px-3 py-1 rounded border ${
                    item.status === "pass"
                      ? "border-[#10b981]/40 bg-[#10b981]/10 text-[#10b981]"
                      : "border-amber-400/40 bg-amber-400/10 text-amber-300"
                  }`}
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-white/[0.08] bg-[#0c0c0f] px-6 py-4 text-xs text-[#a1a1aa]">
            <p className="flex items-center gap-2.5">
              <IconShield className="h-4 w-4 text-[#d4af37]" />
              <span>Garantia de conformidade técnica: nenhuma peça é protocolada com jurisprudência revogada.</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
