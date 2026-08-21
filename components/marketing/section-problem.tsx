"use client";

import { useState } from "react";
import { Reveal } from "./reveal";
import { IconArrowRight, IconCheck } from "./icons";

const CHAOS_TASKS = [
  {
    id: "pesquisar",
    label: "Pesquisar Jurisprudência",
    pain: "5 a 10 abas abertas no Jusbrasil, STJ e TJ procurando ementas que muitas vezes já foram superadas.",
    solution: "O sistema cruza o relatório fático do caso com temas repetitivos e súmulas vinculantes ativas em 2 segundos.",
  },
  {
    id: "ler",
    label: "Ler 200 Páginas de Autos",
    pain: "Horas gastas passando o olho em certidões e comprovantes soltos procurando a data do despacho.",
    solution: "Extração OCR instantânea com linha do tempo processual e destaques de inconsistências de valores.",
  },
  {
    id: "redigir",
    label: "Redigir Petições do Zero",
    pain: "Copiar e colar parágrafos de peças antigas correndo risco de esquecer nomes de partes e pedidos anteriores.",
    solution: "Minutas estruturadas com fundamentação fática, pedidos liquidados e jurisprudência vinculada aos autos.",
  },
  {
    id: "prazos",
    label: "Acompanhar Diários à Mão",
    pain: "Conferir intimações no DJEN e calcular prazos úteis manualmente em planilhas sujeitas a erro humano.",
    solution: "Varredura diária automática com desconto de feriados forenses locais e inclusão direta na pauta.",
  },
  {
    id: "atendimento",
    label: "Responder WhatsApp no Almoço",
    pain: "Clientes mandando 'Doutor, alguma novidade?' a cada 3 dias exigindo que alguém pare o trabalho para checar o PJe.",
    solution: "Portal do Cliente por CPF e respostas automáticas polidas com status real em linguagem acessível.",
  },
];

export function SectionProblem() {
  const [selectedTask, setSelectedTask] = useState(CHAOS_TASKS[0]);

  return (
    <section className="relative overflow-hidden border-t border-white/[0.08] bg-[#09090b] py-28 sm:py-36">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-3xl">
          <Reveal>
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
              01 · O Diagnóstico
            </span>
          </Reveal>
          <Reveal delayMs={100}>
            <h2 className="mt-4 font-display text-4xl font-bold leading-tight text-[#fafaf9] sm:text-5xl lg:text-6xl">
              O problema não é o Direito. <br />
              <span className="font-normal italic text-[#d4af37]">
                É tudo que acontece ao redor dele.
              </span>
            </h2>
          </Reveal>
          <Reveal delayMs={200}>
            <p className="mt-6 text-base leading-relaxed text-[#a1a1aa] sm:text-lg">
              Um advogado gasta até 60% do seu tempo alimentando sistemas desconexos,
              conferindo intimações à mão e copiando dados de um lugar para o outro.
              O tempo de pensar a tese foi engolido pela operação.
            </p>
          </Reveal>
        </div>

        {/* Interactive Friction Resolver */}
        <div className="mt-16 overflow-hidden rounded-xl border border-white/[0.1] bg-[#121216] shadow-[0_20px_60px_rgba(0,0,0,0.7)]">
          <div className="border-b border-white/[0.08] bg-[#0c0c0f] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
            <span className="font-mono text-xs text-[#d4af37] uppercase font-semibold">
              EXPERIMENTE RESOLVER O ATRITO OPERACIONAL (CLIQUE ABAIXO)
            </span>
            <span className="font-mono text-[10px] text-[#a1a1aa]">5 GARGALOS CRÍTICOS</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr]">
            {/* Task Selector List */}
            <div className="p-4 sm:p-6 border-b lg:border-b-0 lg:border-r border-white/[0.08] space-y-2 bg-[#0a0a0d]">
              {CHAOS_TASKS.map((task, idx) => {
                const isSelected = selectedTask.id === task.id;
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => setSelectedTask(task)}
                    className={`w-full flex items-center justify-between rounded-md border p-4 text-left transition-all ${
                      isSelected
                        ? "border-[#d4af37] bg-[#18181f] text-[#fafaf9] shadow-[0_0_15px_rgba(212,175,55,0.12)]"
                        : "border-white/[0.06] bg-transparent text-[#a1a1aa] hover:border-white/[0.15] hover:text-[#fafaf9] hover:bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-[#d4af37]/80">0{idx + 1}</span>
                      <span className="text-xs sm:text-sm font-semibold">{task.label}</span>
                    </div>
                    <IconArrowRight
                      className={`h-4 w-4 transition-transform ${
                        isSelected ? "text-[#d4af37] translate-x-1" : "text-white/20"
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {/* Contrast Transformation Board */}
            <div className="p-6 sm:p-8 flex flex-col justify-between space-y-6 bg-[#121216]">
              <div>
                <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 mb-4">
                  <span className="font-mono text-[10px] font-bold text-red-400 uppercase tracking-wider block mb-1">
                    [x] O Caos Operacional Tradicional:
                  </span>
                  <p className="text-xs sm:text-sm leading-relaxed text-[#fafaf9]/80">
                    {selectedTask.pain}
                  </p>
                </div>

                <div className="rounded-lg border border-[#10b981]/30 bg-[#10b981]/10 p-5">
                  <span className="font-mono text-[10px] font-bold text-[#10b981] uppercase tracking-wider block mb-1">
                    [✓] Como o Jurídico OS Resolve:
                  </span>
                  <p className="text-xs sm:text-sm leading-relaxed text-[#fafaf9] font-medium">
                    {selectedTask.solution}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-white/[0.08] flex items-center justify-between text-xs text-[#a1a1aa]">
                <span>Menos 15 horas semanais perdidas em retrabalho mecânico.</span>
                <span className="font-mono text-[10px] text-[#d4af37] font-semibold">TRANSFORMAÇÃO REAL</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
