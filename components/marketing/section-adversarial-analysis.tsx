"use client";

import { Reveal } from "./reveal";
import { IconAdversarial, IconCheck, IconScale, IconShield } from "./icons";

export function SectionAdversarialAnalysis() {
  return (
    <section className="relative overflow-hidden border-t border-silver/10 bg-[#090f1b] py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <Reveal>
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-silver">
              06 · Simulação Adversarial
            </span>
          </Reveal>
          <Reveal delayMs={100}>
            <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-ice sm:text-4xl lg:text-5xl">
              &ldquo;E se a outra parte <br />
              <span className="font-normal italic text-silver-2">
                atacasse por aqui?&rdquo;
              </span>
            </h2>
          </Reveal>
          <Reveal delayMs={200}>
            <p className="mt-5 text-base leading-relaxed text-muted sm:text-lg">
              Antes da réplica ou da contestação, o sistema assume a perspectiva do advogado contrário,
              identifica vulnerabilidades na sua tese e sugere o reforço probatório necessário.
            </p>
          </Reveal>
        </div>

        {/* Dual Adversarial Comparison Board */}
        <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch">
          {/* Column 1: Sua Tese Principal */}
          <div className="rounded-md border border-silver/20 bg-[#0b1424] p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-silver/10 pb-4">
                <span className="font-mono text-xs text-silver uppercase font-semibold">
                  Sua Tese Proposta
                </span>
                <span className="font-mono text-[10px] text-emerald-400 bg-emerald-400/10 px-2.5 py-0.5 rounded border border-emerald-400/20">
                  AUTOR
                </span>
              </div>

              <div className="mt-6 space-y-4 text-xs sm:text-sm">
                <div>
                  <span className="font-mono text-[10px] text-muted uppercase block">Argumento Base</span>
                  <p className="font-semibold text-ice mt-1">
                    Pleito de Dano Moral Presumido (in re ipsa) em virtude do atraso de 190 dias na entrega do imóvel.
                  </p>
                </div>
                <div>
                  <span className="font-mono text-[10px] text-muted uppercase block">Fundamentação</span>
                  <p className="text-muted leading-relaxed mt-1">
                    Artigo 6º, VI do CDC c/c violação ao direito constitucional à moradia digna.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 rounded-sm border border-silver/10 bg-black/30 p-4 text-xs text-muted">
              <span className="font-mono text-[10px] uppercase text-silver block mb-1">
                STATUS DA ARGUMENTAÇÃO:
              </span>
              Estrutura fática clara, porém sujeita à pacificação jurisprudencial restritiva do STJ.
            </div>
          </div>

          {/* Column 2: O Ataque Antecipado pela IA */}
          <div className="rounded-md border border-amber-400/30 bg-[#121927] p-6 sm:p-8 flex flex-col justify-between shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
            <div>
              <div className="flex items-center justify-between border-b border-amber-400/20 pb-4">
                <span className="font-mono text-xs text-amber-300 uppercase font-semibold flex items-center gap-2">
                  <IconAdversarial className="h-4 w-4" />
                  Ataque Antecipado da Contraparte
                </span>
                <span className="font-mono text-[10px] text-amber-300 bg-amber-400/10 px-2.5 py-0.5 rounded border border-amber-400/20">
                  RÉU PREVISTO
                </span>
              </div>

              <div className="mt-6 space-y-4 text-xs sm:text-sm">
                <div>
                  <span className="font-mono text-[10px] text-amber-300/80 uppercase block">Fragilidade Identificada</span>
                  <p className="font-semibold text-amber-100 mt-1">
                    O mero descumprimento contratual, por si só, não gera dano moral in re ipsa (AgInt no AREsp 1.782.910/SP).
                  </p>
                </div>

                <div>
                  <span className="font-mono text-[10px] text-amber-300/80 uppercase block">Recomendação Preventiva da IA</span>
                  <div className="mt-1.5 rounded-sm border border-emerald-400/30 bg-emerald-400/5 p-3 text-xs text-ice-2">
                    <p className="font-medium text-emerald-300 mb-1">Ação de Reforço Probatório:</p>
                    <p className="text-muted leading-relaxed">
                      Juntar os comprovantes de aluguel pago no período e o contrato de locação emergencial para caracterizar dano reflexo extraordinário antes que o réu apresente a contestação.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex items-center gap-2 text-xs font-mono text-emerald-400 pt-3 border-t border-silver/10">
              <IconCheck className="h-4 w-4" />
              <span>Blindagem probatória sugerida e integrada à minuta</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
