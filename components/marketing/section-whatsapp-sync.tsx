"use client";

import { Reveal } from "./reveal";
import { IconLockSecure, IconWhatsapp } from "./icons";

export function SectionWhatsappSync() {
  return (
    <section className="relative overflow-hidden border-t border-silver/10 bg-[#080d17] py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <Reveal>
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-silver">
              11 · Comunicação e WhatsApp
            </span>
          </Reveal>
          <Reveal delayMs={100}>
            <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-ice sm:text-4xl lg:text-5xl">
              Seu escritório não para quando <br />
              <span className="font-normal italic text-silver-2">
                você fecha o computador.
              </span>
            </h2>
          </Reveal>
          <Reveal delayMs={200}>
            <p className="mt-5 text-base leading-relaxed text-muted sm:text-lg">
              Responda a dúvidas de andamento, envie lembretes de audiência e solicite documentos
              com a discrição e a polidez que a advocacia exige.
            </p>
          </Reveal>
        </div>

        {/* WhatsApp Real Conversation Simulation */}
        <div className="mt-14 mx-auto max-w-xl rounded-md border border-silver/20 bg-[#0c1424] shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-silver/10 bg-black/40 px-5 py-3.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <IconWhatsapp className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-bold text-ice">Escritório Silveira & Advogados</p>
              <p className="font-mono text-[10px] text-emerald-400">Atendimento Oficial Automatizado</p>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="p-5 sm:p-6 space-y-4 text-xs">
            {/* Client Bubble */}
            <div className="ml-auto max-w-[85%] rounded-lg rounded-tr-none bg-silver/10 border border-silver/20 p-3.5 text-ice-2">
              <p className="font-medium text-[11px] text-silver mb-1">Mariana Vasconcelos</p>
              <p className="leading-relaxed">
                Boa tarde, Dr. Pedro! Alguma novidade sobre o andamento da ação contra a construtora?
              </p>
              <span className="font-mono text-[9px] text-muted block text-right mt-1">14:22</span>
            </div>

            {/* Jurídico IA Automated Response Bubble */}
            <div className="mr-auto max-w-[90%] rounded-lg rounded-tl-none bg-black/40 border border-silver/15 p-4 text-ice">
              <div className="flex items-center gap-2 mb-1.5 font-mono text-[10px] text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span>RESPOSTA CONTEXTUAL AUTOMATIZADA</span>
              </div>
              <p className="leading-relaxed text-ice-2">
                Olá, Mariana! Sim: a empresa ré foi formalmente citada pelo oficial de justiça e o juiz agendou a audiência de conciliação virtual para o dia <strong>14/10 às 14h30</strong>.
              </p>
              <p className="mt-2 text-ice-2 leading-relaxed">
                Você pode conferir a íntegra da decisão e anexar os comprovantes pendentes no link do seu portal:
              </p>
              <div className="mt-2 rounded bg-black/40 p-2 font-mono text-[11px] text-silver-2 border border-silver/15">
                portal.juridico.io/caso-0241
              </div>
              <span className="font-mono text-[9px] text-muted block text-right mt-2">14:23 · Enviado pelo Sistema</span>
            </div>
          </div>

          <div className="border-t border-silver/10 bg-black/25 px-5 py-3 text-[11px] text-muted flex items-center justify-between">
            <span>Disparos programados com limites de horário e respeito à LGPD.</span>
            <IconLockSecure className="h-3.5 w-3.5 text-silver/60" />
          </div>
        </div>
      </div>
    </section>
  );
}
