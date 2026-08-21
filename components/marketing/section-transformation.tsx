"use client";

import { Reveal } from "./reveal";
import { IconCheck, IconClose } from "./icons";

const BEFORE_LIST = [
  "Pesquisar jurisprudência em 5 abas abertas simultâneas",
  "Copiar e colar dados de contratos em modelos desatualizados",
  "Organizar pastas e anexos renomeando arquivos manualmente",
  "Revisar peças cansado às 22h caçando erros de digitação",
  "Responder mensagens de WhatsApp repetitivas no horário de almoço",
  "Conferir publicações do diário oficial linha por linha em planilhas",
];

const AFTER_LIST = [
  "Analisar o caso com o contexto probatório e teses já estruturadas",
  "Decidir a melhor estratégia jurídica amparada em dados reais",
  "Revisar minutas completas com auditoria prévia de conformidade",
  "Assinar e protocolar com tranquilidade e tempestividade garantida",
];

export function SectionTransformation() {
  return (
    <section className="relative overflow-hidden border-t border-white/[0.08] bg-[#09090b] py-28 sm:py-36">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-3xl">
          <Reveal>
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
              13 · A Mudança de Rotina
            </span>
          </Reveal>
          <Reveal delayMs={100}>
            <h2 className="mt-4 font-display text-4xl font-bold leading-tight text-[#fafaf9] sm:text-5xl lg:text-6xl">
              Menos atrito operacional. <br />
              <span className="font-normal italic text-[#d4af37]">
                Mais clareza estratégica.
              </span>
            </h2>
          </Reveal>
          <Reveal delayMs={200}>
            <p className="mt-6 text-base leading-relaxed text-[#a1a1aa] sm:text-lg">
              Sem métricas fictícias ou promessas mirabolantes. A transformação está na forma
              como as horas do seu dia são distribuídas.
            </p>
          </Reveal>
        </div>

        {/* Before vs After Dual Panels */}
        <div className="mt-16 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch">
          {/* Panel: Antes */}
          <div className="rounded-xl border border-white/[0.08] bg-[#0c0c0f] p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                <span className="font-mono text-xs text-[#a1a1aa] uppercase tracking-wider font-semibold">
                  A ROTINA TRADICIONAL
                </span>
                <span className="font-mono text-[10px] text-[#a1a1aa] bg-white/[0.05] px-2.5 py-0.5 rounded border border-white/[0.08]">
                  FRAGMENTAÇÃO
                </span>
              </div>
              <ul className="mt-6 space-y-4 text-xs sm:text-sm text-[#a1a1aa]">
                {BEFORE_LIST.map((item) => (
                  <li key={item} className="flex items-start gap-3.5">
                    <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                      <IconClose className="h-2.5 w-2.5" />
                    </span>
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-8 pt-4 border-t border-white/[0.08] text-[11px] font-mono text-[#71717a]">
              60% DO TEMPO CONSUMIDO EM TAREFAS MECÂNICAS
            </div>
          </div>

          {/* Panel: Depois */}
          <div className="rounded-xl border border-[#d4af37]/40 bg-[#121216] p-6 sm:p-8 flex flex-col justify-between shadow-[0_16px_50px_rgba(212,175,55,0.1)]">
            <div>
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                <span className="font-mono text-xs text-[#d4af37] uppercase tracking-wider font-semibold">
                  COM O JURÍDICO OS
                </span>
                <span className="font-mono text-[10px] text-[#10b981] bg-[#10b981]/10 px-2.5 py-0.5 rounded border border-[#10b981]/30">
                  SISTEMA UNIFICADO
                </span>
              </div>
              <ul className="mt-6 space-y-4 text-xs sm:text-sm text-[#fafaf9]">
                {AFTER_LIST.map((item) => (
                  <li key={item} className="flex items-start gap-3.5">
                    <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/40">
                      <IconCheck className="h-2.5 w-2.5" />
                    </span>
                    <span className="font-medium leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-8 pt-4 border-t border-white/[0.08] text-[11px] font-mono text-[#d4af37]">
              FOCO TOTAL EM ANÁLISE, TESES E RELACIONAMENTO COM CLIENTES
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
