import type { ReactNode } from "react";

type Tone = "gold" | "green" | "red" | "muted" | "blue";

const TONE_CLASSES: Record<Tone, string> = {
  gold: "bg-gold/15 text-gold-2 border-gold/30",
  green: "bg-green/15 text-green border-green/30",
  red: "bg-red-500/15 text-red-300 border-red-500/30",
  muted: "bg-white/5 text-muted border-white/10",
  blue: "bg-blue-500/15 text-blue-300 border-blue-500/30",
};

export function Badge({ tone = "muted", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}
