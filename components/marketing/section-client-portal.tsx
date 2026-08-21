"use client";

import { Reveal } from "./reveal";
import { IconCheck, IconClock, IconFileText, IconPortal } from "./icons";

export function SectionClientPortal() {
  return (
    <section className="relative overflow-hidden border-t border-white/[0.08] bg-[#0c0c0f] py-28 sm:py-36">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-3xl">
          <Reveal>
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
              10 · Portal do Cliente
            </span>
          </Reveal>
          <Reveal delayMs={100}>
            <h2 className="mt-4 font-display text-4xl font-bold leading-tight text-[#fafaf9] sm:text-5xl lg:text-6xl">
              O cliente também sabe <br />
              <span className="font-normal italic text-[#d4af37]">
                o que está acontecendo.
              </span>
            </h2>
          </Reveal>
          <Reveal delayMs={200}>
            <p className="mt-6 text-base leading-relaxed text-[#a1a1aa] sm:text-lg">
              Elimine a ansiedade de ligações e mensagens de &ldquo;Doutor, alguma novidade?&rdquo;.
              Cada cliente consulta o status do caso com segurança, apenas com o CPF ou link exclusivo.
            </p>
          </Reveal>
        </div>

        {/* Client Portal Mockup */}
        <div className="mt-16 overflow-hidden rounded-xl border border-white/[0.1] bg-[#121216] shadow-[0_24px_70px_rgba(0,0,0,0.75)]">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between border-b border-white/[0.08] bg-[#0c0c0f] px-6 py-5">
            <div className="flex items-center gap-3.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-sm border border-[#d4af37]/40 bg-[#d4af37]/10 text-[#d4af37]">
                <IconPortal className="h-4 w-4" />
              </span>
              <div>
                <h3 className="font-display text-base font-bold text-[#fafaf9]">
                  Portal de Acompanhamento Processual
                </h3>
                <p className="font-mono text-[10px] text-[#a1a1aa]">CLIENTE: MARIANA L. VASCONCELOS</p>
              </div>
            </div>
            <span className="font-mono text-xs text-[#10b981] bg-[#10b981]/10 px-3 py-1 rounded border border-[#10b981]/30">
              ACESSO SEGURO VIA CPF
            </span>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {/* Case Snapshot Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-white/[0.08] bg-[#0c0c0f] p-4">
                <span className="font-mono text-[10px] uppercase text-[#a1a1aa] block">Status Atual</span>
                <span className="font-display text-lg font-bold text-[#fafaf9] mt-1 block">
                  Em Andamento
                </span>
                <span className="text-xs text-[#d4af37] mt-0.5 block">Fase de Contestação</span>
              </div>

              <div className="rounded-lg border border-white/[0.08] bg-[#0c0c0f] p-4">
                <span className="font-mono text-[10px] uppercase text-[#a1a1aa] block">Próximo Passo</span>
                <span className="font-display text-lg font-bold text-[#fafaf9] mt-1 block">
                  Audiência de Conciliação
                </span>
                <span className="text-xs text-[#d4af37] mt-0.5 block">14 de Outubro às 14h30</span>
              </div>

              <div className="rounded-lg border border-white/[0.08] bg-[#0c0c0f] p-4">
                <span className="font-mono text-[10px] uppercase text-[#a1a1aa] block">Documentos</span>
                <span className="font-display text-lg font-bold text-[#10b981] mt-1 block">
                  2 Pendentes
                </span>
                <span className="text-xs text-[#a1a1aa] mt-0.5 block">Comprovante de residência</span>
              </div>
            </div>

            {/* Timeline Feed */}
            <div className="rounded-lg border border-white/[0.08] bg-[#09090b] p-5 space-y-3">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#d4af37] font-semibold block">
                ÚLTIMAS MOVIMENTAÇÕES EM LINGUAGEM CLARA
              </span>
              <div className="space-y-3 text-xs">
                <div className="flex items-start gap-3">
                  <span className="h-2 w-2 rounded-full bg-[#10b981] mt-1.5" />
                  <div>
                    <p className="font-semibold text-[#fafaf9]">
                      Petição Inicial distribuída com sucesso (19 de Agosto)
                    </p>
                    <p className="text-[#a1a1aa] leading-relaxed mt-0.5">
                      O processo foi protocolado na 14ª Vara Cível da Capital e o juiz determinou a citação da empresa ré.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
