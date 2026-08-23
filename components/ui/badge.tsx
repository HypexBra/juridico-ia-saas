import type { ReactNode } from "react";

type Tone = "silver" | "green" | "red" | "muted" | "blue" | "amber";

const TONE_CLASSES: Record<Tone, string> = {
  silver: "bg-silver/15 text-silver-2 border-silver/30",
  green: "bg-green/15 text-green border-green/30",
  red: "bg-red-700/15 text-red-700 border-red-700/30",
  muted: "bg-ink/5 text-muted border-ink/10",
  blue: "bg-blue-800/15 text-blue-800 border-blue-800/30",
  amber: "bg-amber-700/15 text-amber-700 border-amber-700/30",
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
