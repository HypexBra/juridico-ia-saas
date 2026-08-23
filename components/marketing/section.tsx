import type { ReactNode } from "react";
import { Reveal } from "./reveal";

interface SectionProps {
  /** Âncora para navegação (ex.: "produto"). */
  id?: string;
  /** Número editorial da seção no kicker (ex.: "01"). */
  numero?: string;
  /** Rótulo curto do kicker em caixa alta (mono). */
  kicker: string;
  /** Título H2 da seção (serif editorial). */
  titulo: ReactNode;
  /** Parágrafo de abertura opcional (corpo secundário). */
  intro?: ReactNode;
  /** Variante de fundo: papel (padrão), papel-2 ou painel tinta. */
  tono?: "papel" | "papel2" | "tinta";
  className?: string;
  children: ReactNode;
}

const TONOS = {
  papel: "",
  papel2: "bg-paper-2",
  tinta: "bg-ink text-paper",
} as const;

/**
 * Seção padrão da landing editorial: padding generoso, kicker numerado à
 * esquerda e título/intro dominantes à direita (grid assimétrico da spec,
 * docs/redesign-landing-v3.md §3). Server Component por padrão — animação
 * fica por conta dos <Reveal> internos de cada seção.
 */
export function Section({
  id,
  numero,
  kicker,
  titulo,
  intro,
  tono = "papel",
  className = "",
  children,
}: SectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-titulo` : undefined}
      className={`py-24 md:py-36 ${TONOS[tono]} ${className}`}
    >
      <div className="mx-auto max-w-6xl px-5 md:px-10">
        <div className="grid gap-8 md:grid-cols-12 md:gap-10">
          <div className="md:col-span-3">
            <Reveal>
              <p className="font-mono-ed text-xs uppercase tracking-[0.2em] text-ink-3">
                {numero ? `${numero} · ` : ""}
                {kicker}
              </p>
            </Reveal>
          </div>
          <div className="md:col-span-9 lg:col-span-8">
            <Reveal delayMs={80}>
              <h2
                id={id ? `${id}-titulo` : undefined}
                className="font-serif-ed text-4xl leading-[1.05] tracking-tight text-ink md:text-6xl"
              >
                {titulo}
              </h2>
            </Reveal>
            {intro ? (
              <Reveal delayMs={160}>
                <div className="mt-6 max-w-prose text-lg leading-relaxed text-ink-2">
                  {intro}
                </div>
              </Reveal>
            ) : null}
          </div>
        </div>
        <div className="mt-14 md:mt-20">{children}</div>
      </div>
    </section>
  );
}
