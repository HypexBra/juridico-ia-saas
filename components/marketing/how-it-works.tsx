import { Reveal } from "./reveal";

const STEPS = [
  {
    number: "01",
    title: "Descreva o caso",
    description:
      "Explique os fatos, as partes e o que você precisa em linguagem natural, direto no chat — sem formulários engessados.",
  },
  {
    number: "02",
    title: "A IA analisa e fundamenta",
    description:
      "As questões jurídicas são identificadas e a peça é redigida com base na legislação aplicável e em jurisprudência verificável do STF e STJ.",
  },
  {
    number: "03",
    title: "Você revisa e exporta",
    description:
      "Recebe a minuta completa no painel, ajusta o que precisar e exporta em DOCX ou PDF, já formatada para protocolar.",
  },
  {
    number: "04",
    title: "O prazo entra no controle",
    description:
      "Se a peça tem um vencimento associado, ele já aparece na sua lista de prazos — sem precisar cadastrar em outro lugar.",
  },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="bg-navy-2 py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <div className="mb-16 max-w-xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-gold">
            Como funciona
          </p>
          <h2 className="font-display text-3xl font-bold leading-tight text-ice sm:text-4xl">
            Do caso à peça pronta, em quatro passos
          </h2>
        </div>

        <div className="space-y-0">
          {STEPS.map((step, index) => (
            <Reveal key={step.number} delayMs={index * 80}>
              <div
                className={`flex flex-col gap-6 border-b border-gold/10 py-10 last:border-b-0 sm:flex-row sm:items-center sm:gap-12 ${
                  index % 2 === 1 ? "sm:flex-row-reverse sm:text-right" : ""
                }`}
              >
                <span className="font-display text-6xl font-black leading-none text-gold/25 sm:text-7xl">
                  {step.number}
                </span>
                <div className="max-w-md">
                  <h3 className="font-display text-xl font-bold text-ice">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {step.description}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
