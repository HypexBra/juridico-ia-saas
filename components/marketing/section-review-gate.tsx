"use client";

import { Reveal } from "./reveal";
import { IconCheck, IconFileAudit, IconScale, IconShield } from "./icons";

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
    <section className="relative overflow-hidden border-t border-silver/10 bg-[#080d17] py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <Reveal>
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-silver">
              05 · A Auditoria Pré-Assinatura
            </span>
          </Reveal>
          <Reveal delayMs={100}>
            <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-ice sm:text-4xl lg:text-5xl">
              Antes de você assinar, <br />
              <span className="font-normal italic text-silver-2">
                ela lê de novo.
              </span>
            </h2>
          </Reveal>
          <Reveal delayMs={200}>
            <p className="mt-5 text-base leading-relaxed text-muted sm:text-lg">
              Um erro em um artigo ou em uma soma pode custar a admissibilidade do recurso.
              O sistema atua como uma segunda camada de revisão técnica para blindar sua peça.
            </p>
          </Reveal>
        </div>

        {/* Audit Gate Card */}
        <div className="mt-14 overflow-hidden rounded-md border border-silver/20 bg-[#0c1424] shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
          <div className="flex flex-wrap items-center justify-between border-b border-silver/10 bg-black/40 px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-sm border border-emerald-400/40 bg-emerald-400/10 text-emerald-400">
                <IconCheck className="h-4 w-4" />
              </span>
              <div>
                <h3 className="font-display text-sm font-bold text-ice">
                  Relatório de Auditoria de Peça Processual
                </h3>
                <p className="font-mono text-[10px] text-muted">PETIÇÃO_INICIAL_RESCISAO_vFINAL.DOCX</p>
              </div>
            </div>
            <span className="font-mono text-xs text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded border border-emerald-400/20">
              HABILITADA PARA PROTOCOLO
            </span>
          </div>

          <div className="divide-y divide-silver/10">
            {AUDIT_CHECKLIST.map((item, idx) => (
              <div
                key={item.criterion}
                className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between hover:bg-white/[0.01] transition-colors"
              >
                <div className="flex items-start gap-3.5">
                  <span className="font-mono text-xs text-silver/60 pt-0.5">0{idx + 1}</span>
                  <div>
                    <h4 className="text-xs sm:text-sm font-semibold text-ice">{item.criterion}</h4>
                    <p className="text-[11px] sm:text-xs text-muted mt-0.5">{item.detail}</p>
                  </div>
                </div>
                <span
                  className={`self-start sm:self-auto font-mono text-[11px] font-medium px-3 py-1 rounded border ${
                    item.status === "pass"
                      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                      : "border-amber-400/30 bg-amber-400/10 text-amber-300"
                  }`}
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-silver/10 bg-black/30 px-6 py-4 text-xs text-muted">
            <p className="flex items-center gap-2">
              <IconShield className="h-4 w-4 text-silver" />
              <span>Garantia de conformidade técnica: nenhuma peça é protocolada com jurisprudência revogada.</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
