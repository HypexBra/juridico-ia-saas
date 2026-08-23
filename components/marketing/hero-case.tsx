"use client";

import { useEffect, useRef } from "react";
import { getGsap, prefersReducedMotion } from "@/lib/motion/gsap";
import { IconArrowRight } from "./icons";

/* "CASO 0241" — a representação abstrata do hero (spec v3 §6): um caso
   jurídico sendo organizado sozinho. Ornamento puro (aria-hidden), sem
   glow/gradiente/sombra: papel-2, hairlines ink/10 e UM ponto-lacre.

   Coreografia (GSAP, timeline única repeat:-1 + repeatDelay):
   · linhas do índice são preenchidas em sequência (~1.2s entre elas,
     barra scaleX 0→1 power2.inOut 0.9s, valor entra junto);
   · ticker de eventos troca por crossfade (0.6s troca + 2.2s pausa);
   · o chip "PRAZO 12/09" entra quando o ciclo chega em "1 prazo
     encontrado" e some no recomeço do loop.
   prefers-reduced-motion: estado final estático (tudo visível, ponto
   parado, ticker fixo em "Tarefa criada", chip visível), zero loops. */

interface CaseRow {
  readonly label: string;
  readonly value: string;
}

const CASE_ROWS: readonly CaseRow[] = [
  { label: "CLIENTE", value: "Mariana C. Souza" },
  { label: "PROCESSO", value: "000****-**.0000" },
  { label: "DOCUMENTOS", value: "12 documentos" },
  { label: "LINHA DO TEMPO", value: "4 eventos" },
  { label: "TAREFAS", value: "3 abertas" },
  { label: "ESTRATÉGIA", value: "Risco baixo · 2 teses" },
] as const;

const TICKER_EVENTS = [
  "Documento recebido",
  "Analisando documento…",
  "3 pontos identificados",
  "1 prazo encontrado",
  "Tarefa criada",
] as const;

const TASK_ROW_LABEL = "TAREFAS";
const CHIP_LABEL = "PRAZO 12/09";
const REDUCED_TICKER_TEXT = "Tarefa criada";

/* Índice do evento que dispara a marcação-lacre ("1 prazo encontrado"). */
const CHIP_EVENT_INDEX = TICKER_EVENTS.indexOf("1 prazo encontrado");

/* Temporização do ciclo (segundos). Ciclo ativo ≈ 11.5s + 2.5s de pausa. */
const ROW_STAGGER_S = 1.2;
const BAR_DURATION_S = 0.9;
const VALUE_DURATION_S = 0.6;
const TICKER_STEP_S = 2.8; // 0.6s de crossfade + 2.2s de pausa
const TICKER_FADE_S = 0.3;
const REPEAT_DELAY_S = 2.5;

export function HeroCase() {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const barRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const valueRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const chipRef = useRef<HTMLSpanElement | null>(null);
  const tickerRef = useRef<HTMLParagraphElement | null>(null);
  const dotRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) {
      // Estado final estático, sem nenhum loop.
      for (const bar of barRefs.current) {
        if (bar) bar.style.transform = "scaleX(1)";
      }
      for (const value of valueRefs.current) {
        if (value) value.style.opacity = "1";
      }
      if (chipRef.current) chipRef.current.style.opacity = "1";
      if (tickerRef.current) {
        tickerRef.current.textContent = REDUCED_TICKER_TEXT;
        tickerRef.current.style.opacity = "1";
      }
      return;
    }

    const { gsap } = getGsap();

    const ctx = gsap.context(() => {
      // Pulso MUITO lento do ponto-lacre (ciclo completo de 3s), independente
      // da timeline principal para não ser resetado pelo repeat dela.
      if (dotRef.current) {
        gsap.to(dotRef.current, {
          opacity: 0.4,
          duration: 1.5,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        });
      }

      const tickerEl = tickerRef.current;
      const chipEl = chipRef.current;
      const tl = gsap.timeline({ repeat: -1, repeatDelay: REPEAT_DELAY_S });

      // 1) Linhas do índice preenchidas em sequência.
      CASE_ROWS.forEach((_, index) => {
        const bar = barRefs.current[index];
        const value = valueRefs.current[index];
        const at = index * ROW_STAGGER_S;
        if (bar) {
          tl.fromTo(
            bar,
            { scaleX: 0 },
            { scaleX: 1, duration: BAR_DURATION_S, ease: "power2.inOut" },
            at,
          );
        }
        if (value) {
          tl.fromTo(
            value,
            { autoAlpha: 0, y: 6 },
            { autoAlpha: 1, y: 0, duration: VALUE_DURATION_S, ease: "power2.out" },
            at,
          );
        }
      });

      // 2) Ticker silencioso de eventos (crossfade suave entre mensagens).
      if (tickerEl) {
        tl.fromTo(
          tickerEl,
          { autoAlpha: 0, y: 8 },
          { autoAlpha: 1, y: 0, duration: TICKER_FADE_S * 2, ease: "power1.out" },
          0,
        );
        TICKER_EVENTS.forEach((event, index) => {
          if (index === 0) return;
          const at = index * TICKER_STEP_S;
          tl.to(
            tickerEl,
            { autoAlpha: 0, y: -8, duration: TICKER_FADE_S, ease: "power1.in" },
            at,
          );
          tl.call(
            () => {
              if (tickerRef.current) tickerRef.current.textContent = event;
            },
            undefined,
            at + TICKER_FADE_S,
          );
          tl.fromTo(
            tickerEl,
            { autoAlpha: 0, y: 8 },
            { autoAlpha: 1, y: 0, duration: TICKER_FADE_S, ease: "power1.out" },
            at + TICKER_FADE_S,
          );
        });
      }

      // 3) Marcação-lacre: entra com "1 prazo encontrado"; como todos os
      // tweens usam fromTo com estado inicial explícito, o rewind do loop
      // faz o chip desaparecer sozinho a cada recomeço.
      if (chipEl && CHIP_EVENT_INDEX > 0) {
        tl.fromTo(
          chipEl,
          { autoAlpha: 0, y: 4 },
          { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out" },
          CHIP_EVENT_INDEX * TICKER_STEP_S,
        );
      }
    }, panelRef);

    return () => ctx.revert();
  }, []);

  return (
    <div>
      <p className="sr-only">
        Ilustração: um caso jurídico sendo organizado automaticamente.
      </p>

      <div
        ref={panelRef}
        aria-hidden="true"
        className="rounded-none border border-ink/10 bg-paper-2 p-6 md:p-8"
      >
        {/* Cabeçalho: identificador do caso + status com ponto-lacre */}
        <div className="flex items-center justify-between gap-4 border-b border-ink/10 pb-4">
          <span className="font-mono-ed text-xs tracking-[0.22em] text-ink">CASO 0241</span>
          <span className="flex items-center gap-2 font-mono-ed text-[10px] uppercase tracking-[0.18em] text-ink-3">
            <span ref={dotRef} className="inline-block h-1.5 w-1.5 rounded-full bg-lacre" />
            Em andamento
          </span>
        </div>

        {/* Índice do caso: rótulo mono à esquerda, valor à direita,
            linha inferior que se desenha em cada item */}
        <div className="pt-1">
          {CASE_ROWS.map((row, index) => (
            <div
              key={row.label}
              className="relative flex items-center justify-between gap-4 py-3.5"
            >
              <span className="font-mono-ed text-[11px] uppercase tracking-[0.18em] text-ink-3">
                {row.label}
              </span>
              <span className="flex min-w-0 items-center gap-2 text-right">
                <span
                  ref={(el) => {
                    valueRefs.current[index] = el;
                  }}
                  style={{ opacity: 0 }}
                  className="truncate font-sans-ed text-sm text-ink"
                >
                  {row.value}
                </span>
                {row.label === TASK_ROW_LABEL ? (
                  <span
                    ref={chipRef}
                    style={{ opacity: 0 }}
                    className="shrink-0 rounded-full border border-lacre/30 px-2 py-0.5 font-mono-ed text-[10px] uppercase tracking-[0.14em] text-lacre"
                  >
                    {CHIP_LABEL}
                  </span>
                ) : null}
              </span>
              <span
                ref={(el) => {
                  barRefs.current[index] = el;
                }}
                style={{ transform: "scaleX(0)" }}
                className="pointer-events-none absolute inset-x-0 bottom-0 h-px origin-left bg-ink/60"
              />
            </div>
          ))}
        </div>

        {/* Ticker silencioso de eventos */}
        <div className="mt-5 flex items-center gap-2.5 border-t border-ink/10 pt-4">
          <IconArrowRight className="h-3 w-3 shrink-0 text-ink-3" />
          <p
            ref={tickerRef}
            style={{ opacity: 0 }}
            className="truncate font-mono-ed text-xs text-ink-3"
          >
            {TICKER_EVENTS[0]}
          </p>
        </div>
      </div>
    </div>
  );
}
