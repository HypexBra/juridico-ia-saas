import Link from "next/link";
import { IconArrowRight, IconCheck } from "./icons";
import { Footer } from "./footer";
import { Nav } from "./nav";
import { Reveal } from "./reveal";
import type { Comparativo } from "@/lib/comparativos";
import { DATA_AUDITORIA } from "@/lib/comparativos";

/**
 * Shell compartilhado pelas páginas `/comparativo/*`. Reaproveita Nav/Footer
 * e a paleta papel-e-tinta para parecer nativo do site: mesmo tratamento
 * visual dado às páginas legais (ver `legal-page.tsx`).
 */
export function ComparisonPage({ comparativo }: { comparativo: Comparativo }) {
  return (
    <div className="marketing-root flex min-h-full flex-1 flex-col bg-paper font-sans-ed text-ink">
      <Nav />
      <main id="conteudo" className="flex-1 py-32 md:py-40">
        <div className="mx-auto max-w-4xl px-5 md:px-10">
          <Reveal>
            <p className="font-mono-ed text-xs uppercase tracking-[0.2em] text-ink-3">
              {comparativo.kicker}
            </p>
            <h1 className="mt-4 font-serif-ed text-4xl leading-[1.05] tracking-tight text-ink md:text-5xl">
              {comparativo.titulo}
            </h1>
            <p className="mt-5 max-w-prose text-lg leading-relaxed text-ink-2">
              {comparativo.intro}
            </p>
          </Reveal>

          <Reveal delayMs={80}>
            <div
              role="note"
              className="mt-10 border-l-2 border-accent bg-paper-2 px-5 py-4 md:px-6 md:py-5"
            >
              <p className="font-mono-ed text-[11px] uppercase tracking-[0.18em] text-accent">
                Aviso de honestidade
              </p>
              <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-2">
                Comparação baseada em informação pública disponível em{" "}
                {DATA_AUDITORIA}; funcionalidades de concorrentes podem mudar.
                Consulte o site oficial da {comparativo.nomeConcorrente} para
                confirmar o estado atual.
              </p>
            </div>
          </Reveal>

          <Reveal delayMs={140}>
            <div className="mt-14 overflow-x-auto border border-ink/10">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-ink/10 bg-paper-2">
                    <th scope="col" className="px-5 py-4 font-mono-ed text-[11px] uppercase tracking-[0.14em] text-ink-3">
                      Critério
                    </th>
                    <th scope="col" className="px-5 py-4 font-mono-ed text-[11px] uppercase tracking-[0.14em] text-ink">
                      Jurídico IA
                    </th>
                    <th scope="col" className="px-5 py-4 font-mono-ed text-[11px] uppercase tracking-[0.14em] text-ink-3">
                      {comparativo.nomeConcorrente}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparativo.linhas.map((linha) => (
                    <tr key={linha.dimensao} className="border-b border-ink/10 last:border-b-0">
                      <th
                        scope="row"
                        className="px-5 py-4 align-top font-sans-ed text-sm font-medium text-ink"
                      >
                        {linha.dimensao}
                      </th>
                      <td
                        className={`px-5 py-4 align-top text-sm leading-relaxed ${
                          linha.diferencialJuridicoIa ? "bg-accent/5 text-ink" : "text-ink-2"
                        }`}
                      >
                        <span className="flex items-start gap-2">
                          {linha.diferencialJuridicoIa ? (
                            <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                          ) : null}
                          {linha.juridicoIa}
                        </span>
                      </td>
                      <td className="px-5 py-4 align-top text-sm leading-relaxed text-ink-2">
                        {linha.concorrente}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>

          <Reveal delayMs={200}>
            <p className="mx-auto mt-10 max-w-prose text-base leading-relaxed text-ink-2">
              {comparativo.notaFinal}
            </p>
          </Reveal>

          <Reveal delayMs={240}>
            <div className="mt-14 border-t border-ink/10 pt-10">
              <p className="max-w-prose text-lg leading-relaxed text-ink-2">
                Quer ver a auditoria de peça e o advogado do contra num caso
                seu?
              </p>
              <Link
                href="/cadastro"
                className="mt-5 inline-flex items-center gap-2 rounded-none bg-ink px-6 py-3 font-sans-ed text-sm font-medium text-paper transition-colors hover:bg-ink/90"
              >
                Começar gratuitamente
                <IconArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </Reveal>
        </div>
      </main>
      <Footer />
    </div>
  );
}
