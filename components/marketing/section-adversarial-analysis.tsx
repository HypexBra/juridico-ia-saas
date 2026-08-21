"use client";

import { useState } from "react";
import { Reveal } from "./reveal";
import { IconAdversarial, IconCheck, IconScale, IconShield } from "./icons";

const SCENARIOS = [
  {
    id: "dano-moral",
    title: "1. Tese de Dano Moral In Re Ipsa",
    opponentAttack: "A contraparte alegará que o mero atraso na entrega das chaves não gera dano moral presumido, invocando o AgInt no AREsp 1.782.910/SP.",
    defenseShield: "Juntada antecipada dos comprovantes de aluguel emergencial e notificação de cancelamento de casamento para demonstrar abalo psíquico extraordinário além do mero dissabor.",
    result: "Precedente hostil neutralizado com prova documental nos autos.",
  },
  {
    id: "incompetencia",
    title: "2. Preliminar de Incompetência Territorial",
    opponentAttack: "A ré suscitará a validade da cláusula de eleição de foro na comarca da sede da incorporadora (São Paulo/SP).",
    defenseShield: "Arguição da nulidade de pleno direito da cláusula por ofensa ao art. 101, I, do CDC c/c Súmula 335 do STF, fixando o foro no domicílio do consumidor.",
    result: "Fixação da competência mantida na comarca do seu cliente.",
  },
  {
    id: "fortuito",
    title: "3. Alegação de Caso Fortuito / Chuvas",
    opponentAttack: "A construtora tentará justificar 190 dias de atraso por escassez de insumos e índices pluviométricos acima da média.",
    defenseShield: "Aplicação da Súmula 161 do TJSP: escassez de mão de obra e chuvas configuram fortuito interno inerente ao risco da atividade empresarial.",
    result: "Excludente de responsabilidade sumariamente afastada.",
  },
];

export function SectionAdversarialAnalysis() {
  const [selectedScenario, setSelectedScenario] = useState(SCENARIOS[0]);

  return (
    <section id="war-room" className="relative overflow-hidden border-t border-white/[0.08] bg-[#0c0c0f] py-28 sm:py-36">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-3xl">
          <Reveal>
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
              06 · War Room Adversarial
            </span>
          </Reveal>
          <Reveal delayMs={100}>
            <h2 className="mt-4 font-display text-4xl font-bold leading-tight text-[#fafaf9] sm:text-5xl lg:text-6xl">
              &ldquo;E se a outra parte <br />
              <span className="font-normal italic text-[#d4af37]">
                atacasse por aqui?&rdquo;
              </span>
            </h2>
          </Reveal>
          <Reveal delayMs={200}>
            <p className="mt-6 text-base leading-relaxed text-[#a1a1aa] sm:text-lg">
              Antes de protocolar, o sistema assume a perspectiva do advogado contrário,
              identifica pontos de vulnerabilidade na sua tese e sugere o reforço probatório preventivo.
            </p>
          </Reveal>
        </div>

        {/* War Room Interactive Simulator */}
        <div className="mt-16 overflow-hidden rounded-xl border border-white/[0.1] bg-[#121216] shadow-[0_24px_70px_rgba(0,0,0,0.75)]">
          {/* Scenario Tabs */}
          <div className="flex flex-wrap border-b border-white/[0.08] bg-[#09090b]">
            {SCENARIOS.map((sc) => {
              const isSelected = selectedScenario.id === sc.id;
              return (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => setSelectedScenario(sc)}
                  className={`flex-1 min-w-[200px] p-4 text-xs font-semibold text-left transition-all border-r border-white/[0.06] ${
                    isSelected
                      ? "bg-[#18181f] text-[#d4af37] border-b-2 border-b-[#d4af37]"
                      : "text-[#a1a1aa] hover:text-[#fafaf9]"
                  }`}
                >
                  {sc.title}
                </button>
              );
            })}
          </div>

          {/* Dual Adversarial Comparison Board */}
          <div className="p-6 sm:p-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Opponent Attack */}
            <div className="rounded-xl border border-red-500/30 bg-[#170e12] p-6 space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-red-500/20 pb-3">
                  <span className="font-mono text-xs text-red-300 uppercase font-semibold flex items-center gap-2">
                    <IconAdversarial className="h-4 w-4" />
                    Ataque Antecipado da Contraparte
                  </span>
                  <span className="font-mono text-[10px] text-red-300 bg-red-500/20 px-2 py-0.5 rounded">
                    RISCO IDENTIFICADO
                  </span>
                </div>
                <p className="mt-4 text-xs sm:text-sm leading-relaxed text-red-100">
                  {selectedScenario.opponentAttack}
                </p>
              </div>
              <div className="pt-3 border-t border-red-500/20 text-[11px] font-mono text-red-300/80">
                Ação detectada antes da réplica forense.
              </div>
            </div>

            {/* Defense Shield Counter-Measure */}
            <div className="rounded-xl border border-[#10b981]/30 bg-[#0d1a15] p-6 space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-[#10b981]/20 pb-3">
                  <span className="font-mono text-xs text-[#10b981] uppercase font-semibold flex items-center gap-2">
                    <IconShield className="h-4 w-4" />
                    Blindagem Preventiva da IA
                  </span>
                  <span className="font-mono text-[10px] text-[#10b981] bg-[#10b981]/20 px-2 py-0.5 rounded">
                    CONTRA-MEDIDA
                  </span>
                </div>
                <p className="mt-4 text-xs sm:text-sm leading-relaxed text-[#fafaf9]">
                  {selectedScenario.defenseShield}
                </p>
              </div>

              <div className="pt-3 border-t border-[#10b981]/20 flex items-center gap-2 text-xs font-mono text-[#10b981]">
                <IconCheck className="h-4 w-4" />
                <span>{selectedScenario.result}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
