"use client";

import { useState } from "react";
import { Reveal } from "./reveal";
import { IconArrowRight, IconCheck } from "./icons";

const CHAOS_TASKS = [
  { label: "Pesquisar jurisprudência", phase: "pesquisa" },
  { label: "Organizar autos e anexos", phase: "organizacao" },
  { label: "Ler centenas de páginas", phase: "leitura" },
  { label: "Comparar cláusulas e minutas", phase: "analise" },
  { label: "Escrever petições do zero", phase: "redacao" },
  { label: "Revisar erros de digitação", phase: "revisao" },
  { label: "Acompanhar diários oficiais", phase: "prazos" },
  { label: "Cobrar honorários atrasados", phase: "financeiro" },
  { label: "Responder mensagens repetitivas", phase: "atendimento" },
  { label: "Atualizar planilhas manuais", phase: "gestao" },
];

export function SectionProblem() {
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  return (
    <section className="relative overflow-hidden border-t border-silver/10 bg-[#080d17] py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        {/* Editorial Section Header */}
        <div className="max-w-2xl">
          <Reveal>
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-silver">
              01 · O Diagnóstico
            </span>
          </Reveal>
          <Reveal delayMs={100}>
            <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-ice sm:text-4xl lg:text-5xl">
              O problema não é o Direito. <br />
              <span className="font-normal italic text-silver-2">
                É tudo que acontece ao redor dele.
              </span>
            </h2>
          </Reveal>
          <Reveal delayMs={200}>
            <p className="mt-5 text-base leading-relaxed text-muted sm:text-lg">
              Um advogado gasta até 60% da semana alimentando sistemas desconexos,
              conferindo intimações à mão e copiando informações de um lugar para o outro.
              O tempo de pensar a tese foi engolido pela operação.
            </p>
          </Reveal>
        </div>

        {/* Operational Friction Cloud */}
        <div className="mt-14 rounded-md border border-silver/15 bg-navy-2/30 p-6 sm:p-10 backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-silver/10 pb-4 text-xs">
            <span className="font-mono uppercase text-muted tracking-wider">
              A FRAGMENTAÇÃO DIÁRIA DO ESCRITÓRIO
            </span>
            <span className="font-mono text-silver-2 hidden sm:inline-block">
              10 PONTOS DE ATRITO
            </span>
          </div>

          <div className="mt-6 flex flex-wrap gap-2.5 sm:gap-3">
            {CHAOS_TASKS.map((task, idx) => {
              const isSelected = activeFilter === task.phase;
              return (
                <button
                  key={task.label}
                  type="button"
                  onClick={() => setActiveFilter(isSelected ? null : task.phase)}
                  className={`group flex items-center gap-2 rounded-sm border px-4 py-2.5 text-xs sm:text-sm font-medium transition-all duration-200 ${
                    isSelected
                      ? "border-silver bg-silver/20 text-ice"
                      : "border-silver/20 bg-white/[0.02] text-muted hover:border-silver/40 hover:text-ice-2 hover:bg-white/[0.05]"
                  }`}
                >
                  <span className="font-mono text-[10px] text-silver/60">0{idx + 1}</span>
                  <span>{task.label}</span>
                </button>
              );
            })}
          </div>

          {/* Calming Narrative Resolution */}
          <div className="mt-10 border-t border-silver/10 pt-8">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm border border-emerald-500/40 bg-emerald-500/10 text-emerald-400">
                <IconCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="font-display text-lg font-bold text-ice sm:text-xl">
                  É aí que o Jurídico IA entra.
                </p>
                <p className="mt-1 text-sm text-muted leading-relaxed">
                  Não como mais uma aba aberta no navegador, mas como a espinha dorsal
                  que une peças, publicações, prazos e clientes em uma linha contínua de execução.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
