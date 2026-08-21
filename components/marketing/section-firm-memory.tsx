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
    <section className="relative overflow-hidden border-t border-silver/10 bg-[#090f1a] py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <Reveal>
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-silver">
              12 · Memória Institucional
            </span>
          </Reveal>
          <Reveal delayMs={100}>
            <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-ice sm:text-4xl lg:text-5xl">
              Quanto mais você usa, mais o sistema <br />
              <span className="font-normal italic text-silver-2">
                entende como seu escritório trabalha.
              </span>
            </h2>
          </Reveal>
          <Reveal delayMs={200}>
            <p className="mt-5 text-base leading-relaxed text-muted sm:text-lg">
              Sem declarações vagas de &ldquo;aprendizado genérico&rdquo;.
              O Jurídico IA constrói um repositório isolado de conhecimento proprietário da sua banca, preservando a identidade jurídica que você construiu ao longo dos anos.
            </p>
          </Reveal>
        </div>

        {/* Memory Grid */}
        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2">
          {MEMORY_PILLARS.map((pillar, idx) => (
            <div
              key={pillar.title}
              className="rounded-md border border-silver/15 bg-[#0b1322] p-6 sm:p-8 hover:border-silver/30 transition-colors"
            >
              <div className="flex items-center justify-between border-b border-silver/10 pb-4">
                <span className="font-mono text-xs text-silver">
                  VAULT 0{idx + 1}
                </span>
                <IconMemory className="h-4 w-4 text-silver/60" />
              </div>
              <h3 className="mt-4 font-display text-base sm:text-lg font-bold text-ice">
                {pillar.title}
              </h3>
              <p className="mt-2 text-xs sm:text-sm leading-relaxed text-muted">
                {pillar.desc}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-sm border border-silver/10 bg-black/25 p-4 text-xs text-muted flex items-center justify-between">
          <span className="flex items-center gap-2">
            <IconLockSecure className="h-4 w-4 text-emerald-400" />
            <span>Memória 100% segregada por escritório: seus modelos nunca treinam IAs de terceiros.</span>
          </span>
          <span className="font-mono text-[10px] text-emerald-400 uppercase hidden sm:inline-block">
            ISOLAMENTO MULTI-TENANT
          </span>
        </div>
      </div>
    </section>
  );
}
