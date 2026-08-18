"use client";

import { useEffect, useState } from "react";

export interface BarDatum {
  label: string;
  value: number;
}

/**
 * Barras verticais simples (ex: faturamento por mês) — SVG puro, legível em
 * telas pequenas (rótulos curtos embaixo, valor formatado só na barra em
 * destaque). Cresce em `transform: scaleY` a partir da base (GPU-only),
 * nunca anima `height` diretamente.
 */
export function BarChart({
  data,
  height = 120,
  formatValue = (v: number) => String(v),
  color = "#c9a84c",
}: {
  data: BarDatum[];
  height?: number;
  formatValue?: (value: number) => string;
  color?: string;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="w-full">
      <div className="flex items-end gap-2.5" style={{ height }}>
        {data.map((datum, i) => {
          const ratio = datum.value / max;
          const isLast = i === data.length - 1;
          return (
            <div key={datum.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5" style={{ height: "100%" }}>
              <span className="text-[10px] font-medium text-muted tabular-nums">
                {datum.value > 0 ? formatValue(datum.value) : ""}
              </span>
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full origin-bottom rounded-t-sm"
                  style={{
                    height: "100%",
                    background: isLast ? color : "rgba(201,168,76,0.35)",
                    transform: `scaleY(${mounted ? Math.max(ratio, 0.02) : 0})`,
                    transformOrigin: "bottom",
                    transition: `transform 600ms cubic-bezier(0.16,1,0.3,1) ${i * 60}ms`,
                  }}
                />
              </div>
              <span className="truncate text-[10px] text-muted">{datum.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
