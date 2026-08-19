"use client";

import { useEffect, useState } from "react";

/**
 * Anel de progresso único (uso de IA, % de meta etc.) — SVG puro, sem lib de
 * gráfico. Anima o preenchimento uma vez na montagem (stroke-dashoffset via
 * CSS transition, propriedade acelerada por GPU). `prefers-reduced-motion`
 * já é tratado globalmente em `globals.css` (zera a duração da transição).
 */
export function UsageRing({
  percent,
  label,
  sublabel,
  size = 92,
  strokeWidth = 8,
  tone = "silver",
}: {
  percent: number;
  label: string;
  sublabel?: string;
  size?: number;
  strokeWidth?: number;
  tone?: "silver" | "red";
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, percent));
  const offset = circumference - (mounted ? clamped / 100 : 0) * circumference;
  const color = tone === "red" ? "#f87171" : "#c7d2e8";

  return (
    <div
      role="img"
      aria-label={`${label}: ${Math.round(clamped)}%`}
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center leading-none">
        <span className="font-display text-lg font-bold text-ice">{Math.round(clamped)}%</span>
        {sublabel ? <span className="mt-1 text-[10px] text-muted">{sublabel}</span> : null}
      </div>
    </div>
  );
}
