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
    <section className="border-y border-gold/10 bg-navy-2/60 py-14">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <p className="max-w-xl font-display text-xl italic leading-snug text-ice-2 sm:text-2xl">
          Feito para escritórios que não têm tempo a perder — do advogado
          autônomo à banca com equipe de várias áreas.
        </p>

        <div className="mt-7 flex flex-wrap gap-2.5">
          {AREAS.map((area) => (
            <span
              key={area}
              className="rounded-full border border-gold/20 bg-gold/5 px-3.5 py-1.5 text-xs text-ice-2/90"
            >
              {area}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
