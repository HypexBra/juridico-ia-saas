const AREAS = [
  "Direito Cível & Contratos",
  "Direito do Trabalho & CLT",
  "Direito Tributário & Fiscal",
  "Direito Empresarial & Societário",
  "Direito Imobiliário & Urbanístico",
  "Direito de Família & Sucessões",
  "Direito do Consumidor",
  "Direito Previdenciário",
  "Direito Administrativo & Público",
  "Proteção de Dados & LGPD",
  "Direito Bancário & Financeiro",
  "Recursos nos Tribunais Superiores",
];

export function TrustStrip() {
  return (
    <section className="relative border-y border-silver/10 bg-[#070c16] py-10">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-silver/10 pb-4">
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-silver">
            COBERTURA DE PRÁTICA JURÍDICA
          </span>
          <span className="font-mono text-[11px] text-muted">
            FUNDAMENTAÇÃO ADAPTADA AOS PRINCIPAIS RAMOS FORENSES
          </span>
        </div>

        {/* Continuous Marquee */}
        <div className="mt-5 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
          <div className="flex w-max animate-[marquee_40s_linear_infinite] gap-3 motion-reduce:animate-none">
            {[...AREAS, ...AREAS].map((area, index) => (
              <span
                key={`${area}-${index}`}
                className="shrink-0 rounded-sm border border-silver/15 bg-silver/5 px-4 py-1.5 font-mono text-xs text-silver-2"
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
