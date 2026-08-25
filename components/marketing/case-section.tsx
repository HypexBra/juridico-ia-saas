import { Reveal } from "./reveal";
import { Section } from "./section";

/**
 * Seção 02 · O PRODUTO — o painel do caso inteiro (contexto) e um bloco de
 * pergunta & resposta ancorado nesse contexto (docs/redesign-landing-v3.md §6).
 *
 * Server Component: a revelação do detalhe de cada linha é CSS-only
 * (`group-hover`), sem JavaScript, sem estado.
 */

interface LinhaCaso {
  /** Rótulo mono à esquerda. */
  rotulo: string;
  /** Valor à direita (verdade plausível e consistente entre linhas). */
  valor: string;
  /** Sublinha revelada no hover — detalhe curto e crível. */
  detalhe: string;
}

const LINHAS_CASO: readonly LinhaCaso[] = [
  {
    rotulo: "Cliente",
    valor: "Mariana C. Souza",
    detalhe:
      "Pessoa física. Primeiro atendimento em março; comunicação pelo portal.",
  },
  {
    rotulo: "Processo",
    valor: "000****-**.0000 · 12ª Vara Cível",
    detalhe:
      "Distribuição por dependência. Última movimentação: despacho proferido em 14/08.",
  },
  {
    rotulo: "Documentos",
    valor: "12 · última hoje",
    detalhe:
      "Contrato, anexos e protocolos — indexados para busca e citação na resposta.",
  },
  {
    rotulo: "Histórico",
    valor: "4 eventos este mês",
    detalhe:
      "Duas intimações lidas, uma petição protocolada e audiência designada.",
  },
  {
    rotulo: "Jurisprudência",
    valor: "3 teses mapeadas",
    detalhe:
      "Duas teses favoráveis do STJ sobre repetição de indébito; uma contrária ao caso.",
  },
  {
    rotulo: "Estratégia",
    valor: "Risco baixo",
    detalhe:
      "Documentação completa e pedidos alinhados às teses dominantes na vara.",
  },
  {
    rotulo: "Tarefas",
    valor: "3 abertas · 1 prazo",
    detalhe:
      "Manifestar sobre a impugnação até sexta-feira — prazo gerado pela auditoria.",
  },
] as const;

export function CaseSection() {
  return (
    <Section
      id="produto"
      numero="02"
      kicker="O PRODUTO"
      titulo={
        <>
          Um lugar para o <em>caso inteiro.</em>
        </>
      }
      intro={
        <p>
          A IA não começa pela resposta.{" "}
          <span className="text-ink">Começa pelo contexto.</span>
        </p>
      }
    >
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
        {/* Painel do caso */}
        <Reveal className="lg:col-span-7">
          <div className="rounded-none border border-ink/10 bg-paper-2">
            <header className="flex items-baseline justify-between gap-4 border-b border-ink/10 px-5 py-3.5 md:px-6">
              <h3 className="font-mono-ed text-[11px] uppercase tracking-[0.18em] text-ink-3">
                Ficha do caso
              </h3>
              <span className="font-mono-ed text-[11px] uppercase tracking-[0.18em] text-accent">
                Atualizada hoje
              </span>
            </header>

            <ul className="divide-y divide-ink/10">
              {LINHAS_CASO.map((linha) => (
                <li key={linha.rotulo} className="group px-5 py-4 md:px-6">
                  <div className="flex items-baseline justify-between gap-6">
                    <span className="shrink-0 font-mono-ed text-[11px] uppercase tracking-[0.18em] text-ink-3">
                      {linha.rotulo}
                    </span>
                    <span className="text-right font-sans-ed text-sm leading-snug text-ink md:text-base">
                      {linha.valor}
                    </span>
                  </div>

                  {/* Detalhe sob hover — max-h + opacity, CSS puro.
                      O padding vive no filho interno para não pular na
                      transição (só max-h/opacity animam). */}
                  <div className="max-h-0 overflow-hidden opacity-0 transition-all duration-300 ease-out group-hover:max-h-24 group-hover:opacity-100">
                    <p className="border-l border-accent pt-2 pl-3 text-sm leading-relaxed text-ink-2">
                      {linha.detalhe}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        {/* Bloco Q&A ancorado no contexto acima */}
        <Reveal delayMs={140} className="lg:col-span-5 lg:self-center">
          <div>
            <p className="font-serif-ed text-xl italic leading-snug text-ink md:text-2xl">
              Agora pergunte qualquer coisa sobre este caso.
            </p>

            <div className="mt-6 rounded-none border border-ink/10 bg-paper p-5 md:p-6">
              <span className="inline-flex items-center rounded-full border border-ink/20 px-3 py-1 font-mono-ed text-[10px] uppercase tracking-[0.18em] text-ink-3">
                Pergunta
              </span>

              <p className="mt-3 font-sans-ed text-base font-medium text-ink md:text-lg">
                Quais são os riscos deste caso?
              </p>

              <hr className="my-4 border-t border-ink/10" />

              <p className="font-sans-ed text-sm leading-relaxed text-ink-2 md:text-base">
                Dois pontos concentram o risco:{" "}
                <span className="underline decoration-lacre decoration-2 underline-offset-4">
                  o valor da causa diverge do documento inicial
                </span>
                , o que pode sustentar impugnação, e{" "}
                <span className="underline decoration-lacre decoration-2 underline-offset-4">
                  uma das três teses mapeadas é contrária
                </span>
                . Fora isso, a documentação está completa e os pedidos seguem
                bem fundamentados.
              </p>
            </div>

            <p className="mt-3 font-mono-ed text-[11px] leading-relaxed text-ink-3">
              Respostas ancoradas no contexto do caso.
            </p>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
