"use client";

import { useEffect, useState } from "react";

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

/**
 * Donut multi-segmento (ex: prazos por status) — SVG puro. Cada segmento
 * anima seu próprio `stroke-dashoffset` na montagem, em cascata leve
 * (delay incremental), só com `transform`/opacidade-equivalente
 * (stroke-dashoffset é geometria, mas não dispara layout/reflow — é uma
 * repintura de compositor dentro do próprio elemento SVG).
 */
export function DonutChart({
  segments,
  size = 128,
  strokeWidth = 16,
}: {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulative = 0;
  const arcs = segments.map((segment, i) => {
    const fraction = total > 0 ? segment.value / total : 0;
    const dash = fraction * circumference;
    const dashArray = `${dash} ${circumference - dash}`;
    const offset = mounted ? -cumulative * circumference : 0;
    cumulative += fraction;
    return { ...segment, dashArray, offset, delay: i * 90 };
  });

  return (
    <div className="flex items-center gap-5">
      <div
        role="img"
        aria-label={`Distribuição: ${segments.map((s) => `${s.label} ${s.value}`).join(", ")}`}
        className="relative shrink-0"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
          {/* Trilho em tinta translúcida: branco a 6% era invisível sobre papel. */}
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(20,20,18,0.06)" strokeWidth={strokeWidth} />
          {total === 0
            ? null
            : arcs.map((arc) => (
                <circle
                  key={arc.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={arc.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={mounted ? arc.dashArray : `0 ${circumference}`}
                  strokeDashoffset={arc.offset}
                  strokeLinecap="butt"
                  style={{
                    transition: `stroke-dasharray 700ms cubic-bezier(0.16,1,0.3,1) ${arc.delay}ms`,
                  }}
                />
              ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
          <span className="font-display text-xl font-bold text-ice">{total}</span>
          <span className="mt-1 text-[10px] text-muted">total</span>
        </div>
      </div>

      <ul className="min-w-0 flex-1 space-y-2">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: segment.color }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-muted">{segment.label}</span>
            <span className="shrink-0 font-semibold text-ice">{segment.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
