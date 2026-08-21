"use client";

import { Reveal } from "./reveal";
import { IconCheck, IconClock, IconFileText, IconPortal } from "./icons";

export function SectionClientPortal() {
  return (
    <section className="relative overflow-hidden border-t border-silver/10 bg-[#090f1a] py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <Reveal>
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-silver">
              10 · Portal do Cliente
            </span>
          </Reveal>
          <Reveal delayMs={100}>
            <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-ice sm:text-4xl lg:text-5xl">
              O cliente também sabe <br />
              <span className="font-normal italic text-silver-2">
                o que está acontecendo.
              </span>
            </h2>
          </Reveal>
          <Reveal delayMs={200}>
            <p className="mt-5 text-base leading-relaxed text-muted sm:text-lg">
              Reduza em 80% as ligações e mensagens de &ldquo;Doutor, alguma novidade?&rdquo;.
              Cada cliente consulta o status do caso com segurança, apenas com o CPF ou link exclusivo.
            </p>
          </Reveal>
        </div>

        {/* Client Portal Mockup */}
        <div className="mt-14 overflow-hidden rounded-md border border-silver/20 bg-[#0b1322] shadow-[0_24px_60px_rgba(0,0,0,0.6)]">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between border-b border-silver/10 bg-black/40 px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-sm border border-silver/30 bg-silver/10 text-silver">
                <IconPortal className="h-4 w-4" />
              </span>
              <div>
                <h3 className="font-display text-sm font-bold text-ice">
                  Portal de Acompanhamento Processual
                </h3>
                <p className="font-mono text-[10px] text-muted">CLIENTE: MARIANA L. VASCONCELOS</p>
              </div>
            </div>
            <span className="font-mono text-xs text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded border border-emerald-400/20">
              ACESSO SEGURO VIA CPF
            </span>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {/* Case Snapshot Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-sm border border-silver/15 bg-black/20 p-4">
                <span className="font-mono text-[10px] uppercase text-muted block">Status Atual</span>
                <span className="font-display text-base font-bold text-ice mt-1 block">
                  Em Andamento
                </span>
                <span className="text-[11px] text-silver-2 mt-0.5 block">Fase de Contestação</span>
              </div>

              <div className="rounded-sm border border-silver/15 bg-black/20 p-4">
                <span className="font-mono text-[10px] uppercase text-muted block">Próximo Passo</span>
                <span className="font-display text-base font-bold text-ice mt-1 block">
                  Audiência de Conciliação
                </span>
                <span className="text-[11px] text-silver-2 mt-0.5 block">14 de Outubro às 14h30</span>
              </div>

              <div className="rounded-sm border border-silver/15 bg-black/20 p-4">
                <span className="font-mono text-[10px] uppercase text-muted block">Documentos</span>
                <span className="font-display text-base font-bold text-emerald-400 mt-1 block">
                  2 Pendentes
                </span>
                <span className="text-[11px] text-silver-2 mt-0.5 block">Comprovante de residência</span>
              </div>
            </div>

            {/* Timeline Feed */}
            <div className="rounded-sm border border-silver/10 bg-black/30 p-5 space-y-3">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted block">
                ÚLTIMAS MOVIMENTAÇÕES EXPLICADAS EM LINGUAGEM CLARA
              </span>
              <div className="space-y-3 text-xs">
                <div className="flex items-start gap-3">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 mt-1.5" />
                  <div>
                    <p className="font-semibold text-ice">
                      Petição Inicial distribuída com sucesso (19 de Agosto)
                    </p>
                    <p className="text-muted leading-relaxed mt-0.5">
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
