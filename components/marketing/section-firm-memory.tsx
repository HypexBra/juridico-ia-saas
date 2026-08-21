"use client";

import { Reveal } from "./reveal";
import { IconCheck, IconLockSecure, IconMemory } from "./icons";

const MEMORY_PILLARS = [
  {
    title: "Banco de Teses e Peças Vencedoras",
    desc: "O sistema indexa as petições que obtiveram êxito no seu escritório e utiliza a mesma linha de fundamentação para novos casos semelhantes.",
  },
  {
    title: "Preferências de Redação e Estilo",
    desc: "Direto ao ponto ou mais doutrinário: a IA adota o tom de escrita, os cabeçalhos e a estrutura formal da sua banca.",
  },
  {
    title: "Cláusulas Padrão e Minutas Contratuais",
    desc: "Suas cláusulas mais testadas em litígios são priorizadas na elaboração de novos instrumentos e pareceres.",
  },
  {
    title: "Mapeamento dos Juízos e Varas Locais",
    desc: "A memória registra as inclinações de magistrados locais para antecipar exigências de emenda e produção de provas.",
  },
];

export function SectionFirmMemory() {
  return (
    <section className="relative overflow-hidden border-t border-white/[0.08] bg-[#0c0c0f] py-28 sm:py-36">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-3xl">
          <Reveal>
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
              12 · Memória Institucional
            </span>
          </Reveal>
          <Reveal delayMs={100}>
            <h2 className="mt-4 font-display text-4xl font-bold leading-tight text-[#fafaf9] sm:text-5xl lg:text-6xl">
              Quanto mais você usa, mais o sistema <br />
              <span className="font-normal italic text-[#d4af37]">
                entende como seu escritório trabalha.
              </span>
            </h2>
          </Reveal>
          <Reveal delayMs={200}>
            <p className="mt-6 text-base leading-relaxed text-[#a1a1aa] sm:text-lg">
              Sem declarações vagas de &ldquo;aprendizado genérico&rdquo;.
              O Jurídico OS constrói um repositório isolado de conhecimento proprietário da sua banca, preservando a identidade jurídica que você construiu ao longo dos anos.
            </p>
          </Reveal>
        </div>

        {/* Memory Grid */}
        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2">
          {MEMORY_PILLARS.map((pillar, idx) => (
            <div
              key={pillar.title}
              className="rounded-xl border border-white/[0.08] bg-[#121216] p-6 sm:p-8 hover:border-[#d4af37]/40 transition-all hover:bg-[#18181f]"
            >
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                <span className="font-mono text-xs text-[#d4af37] font-semibold">
                  VAULT DA BANCA 0{idx + 1}
                </span>
                <IconMemory className="h-4 w-4 text-[#d4af37]" />
              </div>
              <h3 className="mt-5 font-display text-lg sm:text-xl font-bold text-[#fafaf9]">
                {pillar.title}
              </h3>
              <p className="mt-2 text-xs sm:text-sm leading-relaxed text-[#a1a1aa]">
                {pillar.desc}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-lg border border-white/[0.08] bg-[#121216] p-5 text-xs text-[#a1a1aa] flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2.5">
            <IconLockSecure className="h-4 w-4 text-[#10b981]" />
            <span>Memória 100% segregada por escritório: seus modelos nunca treinam IAs de terceiros.</span>
          </span>
          <span className="font-mono text-[10px] text-[#10b981] uppercase">
            ISOLAMENTO MULTI-TENANT
          </span>
        </div>
      </div>
    </section>
  );
}
