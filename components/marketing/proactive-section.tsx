import { Reveal } from "./reveal";
import { Section } from "./section";

/**
 * Seção 07 · IA PROATIVA — o painel tinta: a única superfície escura da
 * landing (docs/redesign-landing-v3.md §5/§6). O sistema fala primeiro:
 * três itens que precisam de atenção, sem que o advogado pergunte nada.
 * Headline fica FORA do painel (h2 padrão do Section); o painel escuro é um
 * wrapper interno max-w-5xl com bg-ink/text-paper e acento lacre-bright.
 * Contraste verificado na spec: paper sobre ink ≈ 15:1; lacre-bright sobre
 * ink ≈ 6:1 (AA). Server Component — cascata por <Reveal>.
 */

interface ItemAtencao {
  /** Numeração mono exibida ("01"…"03"). */
  numero: string;
  /** Título curto do alerta. */
  titulo: string;
  /** Sublinha realista com o detalhe operacional. */
  detalhe: string;
}

/** Os 3 itens na ordem exata da spec §6 (prazo → cliente → movimentação). */
const ITENS: readonly ItemAtencao[] = [
  {
    numero: "01",
    titulo: "Prazo em 2 dias.",
    detalhe: "Manifestação com prazo final sexta-feira, às 16h.",
  },
  {
    numero: "02",
    titulo: "Cliente aguardando documento.",
    detalhe: "Documentos solicitados há 6 dias, sem resposta no portal.",
  },
  {
    numero: "03",
    titulo: "Nova movimentação relevante.",
    detalhe: "Despacho mero expediente — resumido, nenhuma ação exigida.",
  },
] as const;

export function ProactiveSection() {
  return (
    <Section
      numero="07"
      kicker="IA PROATIVA"
      titulo={
        <>
          Você não precisa perguntar <em>tudo</em>.
        </>
      }
    >
      <Reveal>
        <div className="mx-auto max-w-5xl rounded-none bg-ink p-8 text-paper md:p-14">
          <p className="font-mono-ed text-xs uppercase tracking-widest text-paper/60">
            Boa tarde.
          </p>
          <p className="mt-6 font-serif-ed text-2xl leading-snug text-paper md:text-3xl">
            Encontrei 3 coisas que precisam da sua atenção.
          </p>

          <ol className="mt-10 divide-y divide-paper/10">
            {ITENS.map(({ numero, titulo, detalhe }, i) => (
              <Reveal
                as="li"
                key={numero}
                delayMs={i * 120}
                className={`${i === 0 ? "" : "pt-8"} ${
                  i === ITENS.length - 1 ? "" : "pb-8"
                }`}
              >
                <div className="flex gap-6">
                  {/* Numeração ornamental — a ordem já é semântica do <ol> */}
                  <span
                    aria-hidden
                    className="pt-0.5 font-mono-ed text-sm leading-none text-lacre-bright"
                  >
                    {numero}
                  </span>
                  <div>
                    <h3 className="font-sans-ed font-medium text-paper">
                      {titulo}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-paper/60">
                      {detalhe}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </Reveal>
    </Section>
  );
}
