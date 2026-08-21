"use client";

import { Reveal } from "./reveal";
import { IconBell, IconClock, IconProactive, IconUsers } from "./icons";

const PROACTIVE_ITEMS = [
  {
    num: "01",
    tag: "PRAZO FATAL EM 48H",
    title: "Contestação à Ação de Cobrança · Proc. 5002931-82",
    detail: "Publicado no DJEN. Minuta preliminar pronta com 100% de conformidade técnica.",
    action: "Revisar Peça",
    tone: "urgent",
  },
  {
    num: "02",
    tag: "PORTAL DO CLIENTE",
    title: "Mariana L. Vasconcelos enviou comprovante de residência",
    detail: "Documento auditado e validado. Pasta do caso atualizada sem necessidade de intervenção manual.",
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
    <section className="relative overflow-hidden border-t border-silver/10 bg-[#090f1a] py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <Reveal>
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-silver">
              08 · Inteligência Proativa
            </span>
          </Reveal>
          <Reveal delayMs={100}>
            <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-ice sm:text-4xl lg:text-5xl">
              Você não precisa <br />
              <span className="font-normal italic text-silver-2">
                perguntar tudo.
              </span>
            </h2>
          </Reveal>
          <Reveal delayMs={200}>
            <p className="mt-5 text-base leading-relaxed text-muted sm:text-lg">
              Em vez de esperar por comandos em uma caixa de chat vazia,
              o sistema analisa seus casos em segundo plano e entrega as prioridades do dia logo pela manhã.
            </p>
          </Reveal>
        </div>

        {/* Daily Intelligence Briefing Card */}
        <div className="mt-14 overflow-hidden rounded-md border border-silver/20 bg-[#0b1322] shadow-[0_24px_60px_rgba(0,0,0,0.6)]">
          {/* Briefing Greeting Header */}
          <div className="border-b border-silver/10 bg-black/40 px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-sm border border-silver/30 bg-silver/10 text-silver">
                  <IconProactive className="h-4 w-4" />
                </span>
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-silver">
                    BRIEFING MATINAL DO ESCRITÓRIO
                  </span>
                  <h3 className="font-display text-base font-bold text-ice">
                    Bom dia, Dr. Pedro. 3 itens demandam sua atenção hoje.
                  </h3>
                </div>
              </div>
              <span className="hidden font-mono text-[10px] text-muted sm:inline-block">
                ATUALIZADO ÀS 08:00
              </span>
            </div>
          </div>

          {/* Priority Items List */}
          <div className="divide-y divide-silver/10 p-2 sm:p-4">
            {PROACTIVE_ITEMS.map((item) => (
              <div
                key={item.num}
                className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-white/[0.02] rounded-sm transition-colors"
              >
                <div className="flex items-start gap-4">
                  <span className="font-mono text-sm font-bold text-silver/60 pt-0.5">{item.num}</span>
                  <div>
                    <span
                      className={`font-mono text-[9px] uppercase px-2 py-0.5 rounded border ${
                        item.tone === "urgent"
                          ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                          : item.tone === "positive"
                          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                          : "border-silver/20 bg-silver/10 text-silver-2"
                      }`}
                    >
                      {item.tag}
                    </span>
                    <h4 className="mt-1.5 text-xs sm:text-sm font-semibold text-ice">{item.title}</h4>
                    <p className="mt-0.5 text-xs text-muted leading-relaxed">{item.detail}</p>
                  </div>
                </div>

                <button
                  type="button"
                  className="self-start sm:self-auto rounded-sm border border-silver/20 bg-silver/5 px-4 py-2 text-xs font-semibold text-silver-2 hover:border-silver/40 hover:bg-silver/15 transition-all whitespace-nowrap"
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
