/**
 * Faixa de prova social discreta entre o Hero e a seção 01 (Problema).
 *
 * Decisão do dono do produto: SEM número/depoimento inventado. Nada de
 * "500+ escritórios" ou citação fabricada. É uma faixa fina (não uma
 * <Section> numerada completa, que quebraria a sequência 01..15 das demais
 * seções), com uma frase honesta sobre o estágio atual do produto.
 */
const PARCEIROS_BETA = [
  "Direito Cível",
  "Direito Trabalhista",
  "Direito de Família",
  "Direito Empresarial",
] as const;

export function SocialProofSection() {
  return (
    <section aria-label="Estágio do produto" className="border-y border-ink/10 bg-paper-2">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-5 py-8 text-center md:flex-row md:justify-between md:gap-6 md:px-10 md:text-left">
        <p className="font-mono-ed text-[11px] uppercase tracking-[0.18em] text-ink-3">
          Em fase beta com escritórios parceiros em todo o Brasil
        </p>
        <ul className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 md:justify-end">
          {PARCEIROS_BETA.map((area, indice) => (
            <li key={area} className="flex items-center gap-2 font-sans-ed text-xs text-ink-3">
              {indice > 0 ? <span aria-hidden>·</span> : null}
              {area}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
