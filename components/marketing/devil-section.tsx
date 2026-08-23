import { Reveal } from "./reveal";
import { Section } from "./section";

/**
 * Seção 05 · ADVOGADO DO CONTRA — a IA argumenta do ponto de vista adversário
 * antes do protocolo (docs/redesign-landing-v3.md §6). Composição estática em
 * duas colunas: tese do advogado à esquerda; painel de ataque à direita, com
 * borda lacre marcando a única "voz" hostil da página. Rodapé honesto
 * obrigatório (spec §8): simulação interna, decisão sempre do advogado.
 * Server Component — animação por <Reveal> apenas.
 */

interface AtaqueAdversario {
  /** Rótulo mono minúsculo da entrada (ex.: "Fragilidade"). */
  rotulo: string;
  /** Observação curta e realista do ponto de vista contrário. */
  texto: string;
}

/** Entradas na ordem exata da spec: fragilidade → argumento → precedente → prova. */
const ATAQUES: readonly AtaqueAdversario[] = [
  {
    rotulo: "Fragilidade",
    texto:
      "A relação não é claramente de consumo — há tese de locação.",
  },
  {
    rotulo: "Argumento contrário",
    texto:
      "Ausência de comprovante do erro de lançamento enfraquece o dano.",
  },
  {
    rotulo: "Precedente contrário",
    texto:
      "Tese diversa prevalece quando o contrato é entre particulares.",
  },
  {
    rotulo: "O que falta de prova",
    texto: "Extratos completos do período questionado.",
  },
] as const;

export function DevilSection() {
  return (
    <Section
      numero="05"
      kicker="ADVOGADO DO CONTRA"
      titulo={
        <>
          E se a outra parte <em>atacasse</em> por aqui?
        </>
      }
      intro="Teste a tese antes de protocolar — a IA argumenta do ponto de vista adversário."
    >
      <div className="grid gap-6 md:grid-cols-2 md:gap-8">
        {/* Coluna esquerda — a tese do advogado, intacta */}
        <Reveal>
          <article className="h-full rounded-none border border-ink/15 bg-paper p-6 md:p-8">
            <p className="font-mono-ed text-[11px] uppercase tracking-[0.18em] text-ink-3">
              Sua tese
            </p>
            <blockquote className="mt-5">
              <p className="font-serif-ed text-xl italic leading-snug text-ink md:text-2xl">
                “O fornecedor responde objetivamente pela cobrança indevida,
                com inversão do ônus da prova em favor do consumidor.”
              </p>
            </blockquote>
            <div className="mt-6 border-t border-ink/10 pt-4">
              <p className="font-mono-ed text-[11px] tracking-wide text-ink-3">
                Caso 0241 · Direito do Consumidor
              </p>
            </div>
          </article>
        </Reveal>

        {/* Coluna direita — painel de ataque adversarial */}
        <Reveal delayMs={120}>
          <article className="h-full rounded-none border border-lacre/40 bg-paper-2 p-6 md:p-8">
            <h3 className="font-mono-ed text-[11px] uppercase tracking-[0.2em] text-lacre">
              Advogado do contra
            </h3>

            <ul className="mt-5 divide-y divide-ink/10">
              {ATAQUES.map(({ rotulo, texto }) => (
                <li key={rotulo} className="py-4 first:pt-0 last:pb-0">
                  <p className="font-mono-ed text-[10px] uppercase tracking-[0.18em] text-lacre">
                    {rotulo}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
                    {texto}
                  </p>
                </li>
              ))}
            </ul>
          </article>
        </Reveal>
      </div>

      <Reveal delayMs={200}>
        <p className="mx-auto mt-6 max-w-3xl font-mono-ed text-[11px] leading-relaxed text-ink-3">
          Simulação adversarial para revisão interna — não substitui a
          estratégia do advogado.
        </p>
      </Reveal>
    </Section>
  );
}
