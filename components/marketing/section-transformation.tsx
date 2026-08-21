"use client";

import { Reveal } from "./reveal";
import { IconArrowRight, IconCheck, IconClose } from "./icons";

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
    <section className="relative overflow-hidden border-t border-silver/10 bg-[#080d17] py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <Reveal>
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-silver">
              13 · A Mudança de Rotina
            </span>
          </Reveal>
          <Reveal delayMs={100}>
            <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-ice sm:text-4xl lg:text-5xl">
              Menos atrito operacional. <br />
              <span className="font-normal italic text-silver-2">
                Mais clareza estratégica.
              </span>
            </h2>
          </Reveal>
          <Reveal delayMs={200}>
            <p className="mt-5 text-base leading-relaxed text-muted sm:text-lg">
              Sem métricas fictícias ou promessas mirabolantes. A transformação está na forma
              como as horas do seu dia são distribuídas.
            </p>
          </Reveal>
        </div>

        {/* Before vs After Dual Panels */}
        <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch">
          {/* Panel: Antes */}
          <div className="rounded-md border border-white/10 bg-black/30 p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <span className="font-mono text-xs text-muted uppercase tracking-wider font-semibold">
                  A ROTINA TRADICIONAL
                </span>
                <span className="font-mono text-[10px] text-muted bg-white/5 px-2.5 py-0.5 rounded border border-white/10">
                  FRAGMENTAÇÃO
                </span>
              </div>
              <ul className="mt-6 space-y-3.5 text-xs sm:text-sm text-muted">
                {BEFORE_LIST.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                      <IconClose className="h-2.5 w-2.5" />
                    </span>
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-8 pt-4 border-t border-white/10 text-[11px] font-mono text-muted/70">
              60% DO TEMPO CONSUMIDO EM TAREFAS MECÂNICAS
            </div>
          </div>

          {/* Panel: Depois */}
          <div className="rounded-md border border-silver/30 bg-[#0d1626] p-6 sm:p-8 flex flex-col justify-between shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
            <div>
              <div className="flex items-center justify-between border-b border-silver/15 pb-4">
                <span className="font-mono text-xs text-silver uppercase tracking-wider font-semibold">
                  COM O JURÍDICO IA
                </span>
                <span className="font-mono text-[10px] text-emerald-400 bg-emerald-400/10 px-2.5 py-0.5 rounded border border-emerald-400/20">
                  SISTEMA UNIFICADO
                </span>
              </div>
              <ul className="mt-6 space-y-4 text-xs sm:text-sm text-ice">
                {AFTER_LIST.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      <IconCheck className="h-2.5 w-2.5" />
                    </span>
                    <span className="font-medium leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-8 pt-4 border-t border-silver/10 text-[11px] font-mono text-emerald-400">
              FOCO TOTAL EM ANÁLISE, TESES E RELACIONAMENTO COM CLIENTES
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
