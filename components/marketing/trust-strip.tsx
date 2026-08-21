const AREAS = [
  "Direito Cível & Contratos",
  "Direito do Trabalho & CLT",
  "Direito Tributário & Fiscal",
  "Direito Empresarial & M&A",
  "Direito Imobiliário & Incorporações",
  "Direito de Família & Sucessões",
  "Direito do Consumidor & Bancário",
  "Direito Previdenciário",
  "Direito Administrativo & Regulatório",
  "Proteção de Dados & LGPD",
  "Recursos no STJ & STF",
  "Arbitragem & Mediação",
];

export function TrustStrip() {
  return (
    <section className="relative border-y border-white/[0.08] bg-[#0c0c0f] py-10">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.06] pb-4">
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-[#d4af37]">
            COBERTURA DE PRÁTICA JURÍDICA
          </span>
          <span className="font-mono text-[11px] text-[#a1a1aa]">
            FUNDAMENTAÇÃO ADAPTADA AOS PRINCIPAIS RAMOS FORENSES
          </span>
        </div>

        {/* Continuous Marquee */}
        <div className="mt-5 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
          <div className="flex w-max animate-[marquee_42s_linear_infinite] gap-3.5 motion-reduce:animate-none">
            {[...AREAS, ...AREAS].map((area, index) => (
              <span
                key={`${area}-${index}`}
                className="shrink-0 rounded-sm border border-white/[0.08] bg-[#141418] px-4 py-2 font-mono text-xs text-[#fafaf9] hover:border-[#d4af37]/40 transition-colors"
              >
                {area}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
