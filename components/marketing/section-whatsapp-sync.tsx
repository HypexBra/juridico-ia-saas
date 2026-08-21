"use client";

import { Reveal } from "./reveal";
import { IconLockSecure, IconWhatsapp } from "./icons";

export function SectionWhatsappSync() {
  return (
    <section className="relative overflow-hidden border-t border-white/[0.08] bg-[#09090b] py-28 sm:py-36">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-3xl">
          <Reveal>
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
              11 · Atendimento Automatizado
            </span>
          </Reveal>
          <Reveal delayMs={100}>
            <h2 className="mt-4 font-display text-4xl font-bold leading-tight text-[#fafaf9] sm:text-5xl lg:text-6xl">
              Seu escritório não para quando <br />
              <span className="font-normal italic text-[#d4af37]">
                você fecha o computador.
              </span>
            </h2>
          </Reveal>
          <Reveal delayMs={200}>
            <p className="mt-6 text-base leading-relaxed text-[#a1a1aa] sm:text-lg">
              Responda a dúvidas de andamento, envie lembretes de audiência e solicite documentos
              com a discrição e a polidez que a advocacia exige.
            </p>
          </Reveal>
        </div>

        {/* WhatsApp Real Conversation Simulation */}
        <div className="mt-16 mx-auto max-w-xl rounded-xl border border-white/[0.1] bg-[#121216] shadow-[0_24px_70px_rgba(0,0,0,0.75)] overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3.5 border-b border-white/[0.08] bg-[#0c0c0f] px-6 py-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/40">
              <IconWhatsapp className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-bold text-[#fafaf9]">Escritório Silveira & Associados</p>
              <p className="font-mono text-[10px] text-[#10b981]">Atendimento Oficial Automatizado</p>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="p-6 sm:p-7 space-y-4 text-xs">
            {/* Client Bubble */}
            <div className="ml-auto max-w-[85%] rounded-xl rounded-tr-none bg-[#18181f] border border-white/[0.08] p-4 text-[#fafaf9]">
              <p className="font-medium text-[11px] text-[#d4af37] mb-1">Mariana Vasconcelos</p>
              <p className="leading-relaxed">
                Boa tarde, Dr. Pedro! Alguma novidade sobre o andamento da ação contra a construtora?
              </p>
              <span className="font-mono text-[9px] text-[#a1a1aa] block text-right mt-1">14:22</span>
            </div>

            {/* Jurídico IA Automated Response Bubble */}
            <div className="mr-auto max-w-[90%] rounded-xl rounded-tl-none bg-[#09090b] border border-white/[0.08] p-4 text-[#fafaf9]">
              <div className="flex items-center gap-2 mb-2 font-mono text-[10px] text-[#10b981]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#10b981]" />
                <span>RESPOSTA CONTEXTUAL AUTOMATIZADA</span>
              </div>
              <p className="leading-relaxed text-[#fafaf9]">
                Olá, Mariana! Sim: a empresa ré foi formalmente citada pelo oficial de justiça e o juiz agendou a audiência de conciliação virtual para o dia <strong>14/10 às 14h30</strong>.
              </p>
              <p className="mt-2 text-[#a1a1aa] leading-relaxed">
                Você pode conferir a íntegra da decisão e anexar os comprovantes pendentes no link do seu portal:
              </p>
              <div className="mt-2 rounded bg-black/40 p-2 font-mono text-[11px] text-[#d4af37] border border-white/[0.06]">
                portal.juridico.io/caso-0241
              </div>
              <span className="font-mono text-[9px] text-[#a1a1aa] block text-right mt-2">14:23 · Enviado pelo Sistema</span>
            </div>
          </div>

          <div className="border-t border-white/[0.08] bg-[#0c0c0f] px-6 py-3.5 text-[11px] text-[#a1a1aa] flex items-center justify-between">
            <span>Disparos programados com limites de horário e respeito à LGPD.</span>
            <IconLockSecure className="h-3.5 w-3.5 text-[#d4af37]" />
          </div>
        </div>
      </div>
    </section>
  );
}
