const AREAS = [
  "Cível",
  "Trabalhista",
  "Penal",
  "Tributário",
  "Constitucional",
  "Consumidor",
  "Família",
  "Administrativo",
  "Empresarial",
  "Previdenciário",
  "LGPD",
  "Imobiliário",
];

export function TrustStrip() {
  return (
    <section className="relative border-y border-silver/10 bg-navy-2/25 py-14">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <p className="max-w-xl font-display text-xl italic leading-snug text-ice-2 sm:text-2xl">
          Feito para escritórios que não têm tempo a perder — do advogado
          autônomo à banca com equipe de várias áreas.
        </p>

        {/*
          Marquee contínuo em CSS puro (translate3d, GPU-accelerated) — sem
          JS, sem ScrollTrigger: é decoração ambiente, não algo ligado à
          posição de scroll. `motion-reduce:animate-none` desliga o loop para
          quem pediu menos movimento.
        */}
        <div className="mt-7 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
          <div className="flex w-max animate-[marquee_34s_linear_infinite] gap-2.5 motion-reduce:animate-none">
            {[...AREAS, ...AREAS].map((area, index) => (
              <span
                key={`${area}-${index}`}
                className="shrink-0 rounded-full border border-silver/20 bg-silver/5 px-3.5 py-1.5 text-xs text-ice-2/90"
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
