import { Reveal } from "./reveal";
import { Section } from "./section";

/* 12 · RESULTADO (spec v3 §6): comparação tipográfica ANTES/DEPOIS, sem
   números nem métricas (proibição da spec). ANTES: verbos operacionais
   riscados com opacidade decrescente — o trabalho se dissolvendo. DEPOIS:
   os quatro verbos que restam, sólidos, cada um precedido de um traço-lacre.
   Hairline vertical entre as colunas no desktop. A coluna DEPOIS revela
   com delay maior: a transformação chega depois do diagnóstico.
   Server Component puro. */

interface VerboAntes {
  readonly palavra: string;
  /** Opacidade decrescente — a operação desaparecendo. */
  readonly opacidade: number;
}

const VERBOS_ANTES: readonly VerboAntes[] = [
  { palavra: "Pesquisar", opacidade: 1 },
  { palavra: "Copiar", opacidade: 0.85 },
  { palavra: "Organizar", opacidade: 0.7 },
  { palavra: "Revisar", opacidade: 0.55 },
  { palavra: "Responder", opacidade: 0.42 },
  { palavra: "Acompanhar", opacidade: 0.3 },
] as const;

const VERBOS_DEPOIS = ["Analisar", "Decidir", "Revisar", "Assinar"] as const;

/** Cascata dos itens ANTES (ms) — leitura rápida, quase apagando. */
const PASSO_ANTES_MS = 70;
/** Base da cascata DEPOIS (ms) — entra depois de toda a lista ANTES. */
const BASE_DEPOIS_MS = 420;
const PASSO_DEPOIS_MS = 100;

export function ResultSection() {
  return (
    <Section
      numero="12"
      kicker="RESULTADO"
      titulo={
        <>
          Menos operação. Mais <em className="italic">advocacia</em>.
        </>
      }
    >
      {/* relative ancora a hairline vertical central (desktop) */}
      <div className="relative mx-auto max-w-4xl">
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-1/2 hidden w-px bg-ink/10 md:block"
        />

        <div className="grid gap-10 md:grid-cols-2">
          {/* ANTES — o trabalho operacional riscado e se dissolvendo */}
          <div>
            <Reveal>
              <p className="font-mono-ed text-xs uppercase tracking-[0.2em] text-ink-3">
                ANTES
              </p>
            </Reveal>
            <ul className="mt-6 space-y-3">
              {VERBOS_ANTES.map((verbo, index) => (
                <Reveal key={verbo.palavra} as="li" delayMs={index * PASSO_ANTES_MS}>
                  <span
                    className="font-serif-ed text-2xl leading-snug text-ink-3 line-through decoration-1"
                    style={{ opacity: verbo.opacidade }}
                  >
                    {verbo.palavra}
                  </span>
                </Reveal>
              ))}
            </ul>
          </div>

          {/* DEPOIS — o que sobra para o advogado, sólido e marcado em lacre */}
          <div>
            <Reveal delayMs={BASE_DEPOIS_MS - PASSO_DEPOIS_MS}>
              <p className="font-mono-ed text-xs uppercase tracking-[0.2em] text-accent">
                DEPOIS
              </p>
            </Reveal>
            <ul className="mt-6 space-y-4">
              {VERBOS_DEPOIS.map((palavra, index) => (
                <Reveal key={palavra} as="li" delayMs={BASE_DEPOIS_MS + index * PASSO_DEPOIS_MS}>
                  <span className="font-serif-ed text-2xl leading-snug text-ink md:text-3xl">
                    <span
                      aria-hidden="true"
                      className="mr-4 inline-block w-6 border-t-2 border-accent align-middle"
                    />
                    {palavra}
                  </span>
                </Reveal>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Section>
  );
}
