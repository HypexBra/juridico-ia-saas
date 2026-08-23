import { Reveal } from "./reveal";
import { Section } from "./section";

/**
 * Seção 03 · DOCUMENTOS — página de contrato com marcações numeradas ligadas
 * a uma coluna lateral de leitura (docs/redesign-landing-v3.md §6).
 *
 * Server Component: marcações inline são spans estáticos; nada depende de
 * JavaScript. Os círculos ①②③ são ornamento (aria-hidden) — a coluna lateral
 * carrega o conteúdo acessível.
 */

interface ResumoAnalise {
  numero: string;
  rotulo: string;
}

const RESUMO_ANALISE: readonly ResumoAnalise[] = [
  { numero: "3", rotulo: "pontos relevantes" },
  { numero: "2", rotulo: "inconsistências" },
  { numero: "1", rotulo: "prazo" },
  { numero: "4", rotulo: "documentos relacionados" },
] as const;

interface Marcacao {
  numero: 1 | 2 | 3;
  texto: string;
  /** Classificação curta exibida sob o texto (ex.: inconsistência). */
  tag?: "Inconsistência";
}

const MARCACOES: readonly Marcacao[] = [
  {
    numero: 1,
    texto: "Cláusula de multa divergente do anexo",
    tag: "Inconsistência",
  },
  { numero: 2, texto: "Prazo de rescisão: 30 dias" },
  { numero: 3, texto: "Valor atualizado ausente" },
] as const;

/** Círculo numerado do lacre — exceção de canto permitida pela spec. */
function CirculoMarcacao({
  numero,
  className = "",
}: {
  numero: 1 | 2 | 3;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-accent font-mono-ed text-[10px] leading-none text-accent ${className}`}
    >
      {numero}
    </span>
  );
}

/** Marcador inline sobreposto ao trecho de origem no documento. */
function MarcadorInline({ numero }: { numero: 1 | 2 | 3 }) {
  return <CirculoMarcacao numero={numero} className="ml-1 -translate-y-1 align-middle" />;
}

export function DocumentsSection() {
  return (
    <Section
      numero="03"
      kicker="DOCUMENTOS"
      titulo={
        <>
          Cada documento, lido com <em>atenção de especialista.</em>
        </>
      }
    >
      {/* Resumo da análise em chips mono — números no lacre */}
      <Reveal>
        <ul className="flex flex-wrap gap-2.5">
          {RESUMO_ANALISE.map((item) => (
            <li
              key={item.rotulo}
              className="rounded-full border border-ink/10 bg-paper-2 px-4 py-1.5 font-mono-ed text-[11px] tracking-wide text-ink-2"
            >
              <span className="text-accent">{item.numero}</span> {item.rotulo}
            </li>
          ))}
        </ul>
      </Reveal>

      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_250px] lg:gap-16">
        {/* Folha do documento */}
        <Reveal className="min-w-0">
          <article className="mx-auto max-w-3xl rounded-none border border-ink/10 bg-paper p-7 shadow-sm sm:p-10 md:p-12">
            <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-ink/10 pb-4">
              <h3 className="font-mono-ed text-[11px] uppercase tracking-[0.18em] text-ink-3">
                Extrato de contrato · Pág. 7/23
              </h3>
              <span className="font-mono-ed text-[11px] uppercase tracking-[0.18em] text-ink-3">
                Doc. 04/12
              </span>
            </header>

            <div className="space-y-4 pt-6 font-serif-ed text-[13px] leading-relaxed text-ink-2 md:text-sm">
              <p>
                <strong className="font-semibold text-ink">
                  Cláusula Quinta – Dos Encargos Moratórios.
                </strong>{" "}
                O atraso no pagamento de qualquer das parcelas implicará, de
                pleno direito, a incidência de multa não compensatória de 2%
                (dois por cento)
                <MarcadorInline numero={1} /> sobre o montante devido, além de
                juros de mora de 1% (um por cento) ao mês, contados do evento
                da inadimplência, e correção monetária pela variação acumulada
                do IPCA.
              </p>

              <p>
                Parágrafo único. Os encargos previstos nesta cláusula não se
                acumulam com as penalidades estabelecidas no instrumento
                principal, prevalecendo a disposição mais benévola ao
                devedor, salvo disposição expressa em contrário.
              </p>

              <p>
                <strong className="font-semibold text-ink">
                  Cláusula Nona – Da Rescisão.
                </strong>{" "}
                Qualquer das partes poderá rescindir este contrato mediante
                notificação escrita à parte contrária, com antecedência
                mínima de 30 (trinta) dias
                <MarcadorInline numero={2} />, sem ônus para o notificante,
                desde que quitados os créditos vencidos até a data do
                aviso.
              </p>

              <p>
                <strong className="font-semibold text-ink">
                  Cláusula Décima – Da Atualização.
                </strong>{" "}
                Os valores pactuados serão corrigidos anualmente na
                data-base de janeiro, aplicando-se a variação acumulada do
                índice de referência adotado pelas partes.
                <MarcadorInline numero={3} />
              </p>
            </div>
          </article>
        </Reveal>

        {/* Coluna lateral: as marcações, conectadas por número */}
        <Reveal delayMs={140} className="lg:self-start">
          <div>
            <h3 className="font-mono-ed text-[11px] uppercase tracking-[0.18em] text-ink-3">
              Marcações
            </h3>

            <ol className="mt-5 space-y-7 border-l border-ink/10 pl-6">
              {MARCACOES.map((marcacao) => (
                <li key={marcacao.numero} className="relative">
                  <CirculoMarcacao
                    numero={marcacao.numero}
                    className="absolute -left-[34px] top-0 bg-paper"
                  />
                  <p className="font-sans-ed text-sm leading-snug text-ink">
                    {marcacao.texto}
                  </p>
                  {marcacao.tag ? (
                    <p className="mt-1.5 font-mono-ed text-[10px] uppercase tracking-[0.18em] text-accent">
                      {marcacao.tag}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        </Reveal>
      </div>

      {/* Nota honesta — spec §8: nunca verdade jurídica absoluta */}
      <Reveal delayMs={100}>
        <p className="mt-10 text-center font-mono-ed text-[11px] leading-relaxed text-ink-3">
          Análise assistida — cada ponto aponta para o trecho de origem.
        </p>
      </Reveal>
    </Section>
  );
}
