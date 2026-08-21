"use client";

import { Reveal } from "./reveal";
import { IconBell, IconClock, IconProactive, IconUsers } from "./icons";

const PROACTIVE_ITEMS = [
  {
    num: "01",
    tag: "PRAZO FATAL EM 48H",
    title: "Contestação à Ação de Cobrança · Proc. 5002931-82",
    detail: "Publicado no DJEN Caderno 3. Minuta preliminar pronta com 100% de conformidade técnica.",
    action: "Revisar Peça",
    tone: "urgent",
  },
  {
    num: "02",
    tag: "PORTAL DO CLIENTE",
    title: "Mariana L. Vasconcelos enviou comprovante de residência",
    detail: "Documento auditado e validado. Pasta do caso atualizada sem necessidade de conferência manual.",
    action: "Ver Anexo",
    tone: "info",
  },
  {
    num: "03",
    tag: "PRECEDENTE RELEVANTE",
    title: "Novo acórdão da 3ª Turma do STJ sobre Tema 971",
    detail: "Tese favorável ao seu cliente publicada ontem. Sugestão de inclusão nos memoriais da apelação.",
    action: "Adicionar aos Autos",
    tone: "positive",
  },
];

export function SectionProactiveBriefing() {
  return (
    <section id="radar-djen" className="relative overflow-hidden border-t border-white/[0.08] bg-[#0c0c0f] py-28 sm:py-36">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-3xl">
          <Reveal>
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
              08 · Inteligência Proativa
            </span>
          </Reveal>
          <Reveal delayMs={100}>
            <h2 className="mt-4 font-display text-4xl font-bold leading-tight text-[#fafaf9] sm:text-5xl lg:text-6xl">
              Você não precisa <br />
              <span className="font-normal italic text-[#d4af37]">
                perguntar tudo.
              </span>
            </h2>
          </Reveal>
          <Reveal delayMs={200}>
            <p className="mt-6 text-base leading-relaxed text-[#a1a1aa] sm:text-lg">
              Em vez de esperar por comandos em uma caixa de chat vazia,
              o sistema analisa seus casos em segundo plano e entrega as prioridades do dia logo pela manhã.
            </p>
          </Reveal>
        </div>

        {/* Daily Intelligence Briefing Card */}
        <div className="mt-16 overflow-hidden rounded-xl border border-white/[0.1] bg-[#121216] shadow-[0_24px_70px_rgba(0,0,0,0.75)]">
          {/* Briefing Greeting Header */}
          <div className="border-b border-white/[0.08] bg-[#0c0c0f] px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-sm border border-[#d4af37]/40 bg-[#d4af37]/10 text-[#d4af37]">
                  <IconProactive className="h-4 w-4" />
                </span>
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[#d4af37] font-semibold">
                    BRIEFING MATINAL DO ESCRITÓRIO
                  </span>
                  <h3 className="font-display text-lg font-bold text-[#fafaf9]">
                    Bom dia, Dr. Pedro. 3 itens demandam sua atenção hoje.
                  </h3>
                </div>
              </div>
              <span className="font-mono text-[10px] text-[#a1a1aa] bg-white/[0.05] px-3 py-1 rounded border border-white/[0.08]">
                ATUALIZADO ÀS 08:00
              </span>
            </div>
          </div>

          {/* Priority Items List */}
          <div className="divide-y divide-white/[0.06] p-2 sm:p-4">
            {PROACTIVE_ITEMS.map((item) => (
              <div
                key={item.num}
                className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between hover:bg-white/[0.02] rounded-lg transition-colors"
              >
                <div className="flex items-start gap-4">
                  <span className="font-mono text-sm font-bold text-[#d4af37] pt-0.5">{item.num}</span>
                  <div>
                    <span
                      className={`font-mono text-[9px] uppercase px-2.5 py-0.5 rounded border ${
                        item.tone === "urgent"
                          ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                          : item.tone === "positive"
                          ? "border-[#10b981]/40 bg-[#10b981]/10 text-[#10b981]"
                          : "border-[#d4af37]/30 bg-[#d4af37]/10 text-[#d4af37]"
                      }`}
                    >
                      {item.tag}
                    </span>
                    <h4 className="mt-2 text-xs sm:text-sm font-semibold text-[#fafaf9]">{item.title}</h4>
                    <p className="mt-0.5 text-xs text-[#a1a1aa] leading-relaxed">{item.detail}</p>
                  </div>
                </div>

                <button
                  type="button"
                  className="self-start sm:self-auto rounded-sm border border-[#d4af37]/40 bg-[#d4af37]/10 px-5 py-2 text-xs font-semibold text-[#d4af37] hover:border-[#d4af37] hover:bg-[#d4af37]/20 transition-all whitespace-nowrap"
                >
                  {item.action}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
