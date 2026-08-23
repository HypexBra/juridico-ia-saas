import { Reveal } from "./reveal";
import { Section } from "./section";
import { IconArrowRight } from "./icons";

/**
 * Seção 08 · PESQUISA VERIFICÁVEL — busca mock com resultados que carregam
 * órgão, número, data e trecho (docs/redesign-landing-v3.md §6/§7). Conteúdo
 * genericamente verdadeiro sobre o tema, com número de processo MASCARADO
 * (nunca inventar citação real) e caption honesta de ilustração. Bloco final
 * de honestidade: sem fonte suficiente, o sistema admite que não encontrou.
 * Server Component — Reveals suaves.
 */

interface CampoFonte {
  /** Rótulo mono do metadado (ex.: "Órgão"). */
  rotulo: string;
  /** Valor exibido ao lado do rótulo. */
  valor: string;
}

/** Metadados da jurisprudência na ordem da spec: órgão → classe/número → relator → data. */
const CAMPOS_JURISPRUDENCIA: readonly CampoFonte[] = [
  { rotulo: "Órgão", valor: "STJ" },
  { rotulo: "Classe / Número", valor: "Recurso Especial · nº mascarado ****" },
  { rotulo: "Relator", valor: "Ministro relator" },
  { rotulo: "Data", valor: "julgado em 2024" },
] as const;

export function ResearchSection() {
  return (
    <Section
      id="recursos"
      numero="08"
      kicker="PESQUISA VERIFICÁVEL"
      titulo={
        <>
          Resposta <em>sem fonte</em> não entra na página.
        </>
      }
      intro="Legislação e jurisprudência com órgão, número, data e trecho — ou o sistema admite que não encontrou."
    >
      {/* Barra de busca mock — composição decorativa, não um input falso */}
      <Reveal>
        <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-none border border-ink/20 bg-paper-2 px-4 py-3">
          <p className="font-mono-ed text-sm text-ink">
            responsabilidade civil por cobrança indevida
          </p>
          <IconArrowRight className="ml-auto h-4 w-4 shrink-0 text-ink-3" />
        </div>
      </Reveal>

      <Reveal delayMs={80}>
        <div className="mx-auto mt-6 max-w-3xl divide-y divide-ink/10 rounded-none border-x border-b border-ink/10">
          {/* LEGISLAÇÃO */}
          <section className="px-5 pb-6 pt-5 md:px-6">
            <h3 className="font-mono-ed text-[11px] uppercase tracking-[0.2em] text-ink-3">
              Legislação
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-ink-2">
              <span className="font-medium text-ink">
                Código de Defesa do Consumidor · Art. 42
              </span>{" "}
              — cobrança sem discriminação do valor deve ser devolvida em
              dobro, sem prejuízo de perdas e danos.
            </p>
          </section>

          {/* JURISPRUDÊNCIA */}
          <section className="px-5 pb-6 pt-5 md:px-6">
            <h3 className="font-mono-ed text-[11px] uppercase tracking-[0.2em] text-ink-3">
              Jurisprudência
            </h3>

            <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {CAMPOS_JURISPRUDENCIA.map(({ rotulo, valor }) => (
                <div key={rotulo}>
                  <dt className="font-mono-ed text-[10px] uppercase tracking-[0.18em] text-ink-3">
                    {rotulo}
                  </dt>
                  <dd className="mt-1 text-sm leading-relaxed text-ink">
                    {valor}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-4">
              <p className="font-mono-ed text-[10px] uppercase tracking-[0.18em] text-ink-3">
                Trecho
              </p>
              <blockquote className="mt-1">
                <p className="font-serif-ed text-base italic leading-snug text-ink">
                  …a repetição em dobro independe de má-fé…
                </p>
              </blockquote>
            </div>

            <p className="mt-4 font-mono-ed text-[10px] leading-relaxed text-ink-3">
              Resultado ilustrativo — a base real consulta dados abertos do STJ.
            </p>
          </section>

          {/* CASOS RELACIONADOS */}
          <section className="px-5 pb-6 pt-5 md:px-6">
            <h3 className="font-mono-ed text-[11px] uppercase tracking-[0.2em] text-ink-3">
              Casos relacionados
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-ink-2">
              <span className="font-mono-ed text-[13px] text-ink">
                Caso 0241
              </span>{" "}
              · documentos 03, 07 e 12 citam o mesmo dispositivo.
            </p>
          </section>
        </div>
      </Reveal>

      {/* Honestidade obrigatória — spec §8: nunca inventar para preencher */}
      <Reveal delayMs={160}>
        <div className="mx-auto mt-8 max-w-3xl border-l-2 border-lacre pl-5">
          <p className="text-sm leading-relaxed text-ink-2">
            Quando a base não tem fonte suficiente, a resposta é: “Não foi
            localizada fonte verificável suficiente.” Nada é inventado para
            preencher lacunas.
          </p>
        </div>
      </Reveal>
    </Section>
  );
}
