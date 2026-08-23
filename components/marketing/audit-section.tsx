import { Reveal } from "./reveal";
import { Section } from "./section";
import { IconCheck } from "./icons";

/**
 * Seção 04 · AUDITORIA — relatório de re-leitura da peça antes da assinatura
 * (docs/redesign-landing-v3.md §6). Nunca cor sozinha: aprovação usa o
 * símbolo de check + texto acessível; alerta usa círculo-lacre com "!" e
 * observação expandida. Rodapé honesto obrigatório (spec §8).
 */

interface DimensaoAuditoria {
  rotulo: string;
}

/** Dimensões na ordem exata da spec: Fundamentação ✓ · Coerência ✓ ·
    Pedidos ! · Jurisprudência ✓ · Contradições 2. */
const DIMENSOES_APROVADAS: readonly DimensaoAuditoria[] = [
  { rotulo: "Fundamentação" },
  { rotulo: "Coerência" },
] as const;

export function AuditSection() {
  return (
    <Section
      numero="04"
      kicker="AUDITORIA"
      titulo={
        <>
          Antes de você assinar, ela <em>lê de novo.</em>
        </>
      }
    >
      <Reveal>
        <article className="mx-auto max-w-2xl rounded-none border border-ink/10 bg-paper">
          <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-ink/10 px-5 py-3.5 md:px-6">
            <h3 className="font-mono-ed text-[11px] uppercase tracking-[0.18em] text-ink-3">
              Petição inicial · Auditada agora
            </h3>
            <span className="font-mono-ed text-[11px] uppercase tracking-[0.18em] text-ink-3">
              5 dimensões
            </span>
          </header>

          <ul className="divide-y divide-ink/10">
            {DIMENSOES_APROVADAS.map(({ rotulo }) => (
              <li
                key={rotulo}
                className="flex items-center justify-between gap-4 px-5 py-4 md:px-6"
              >
                <span className="font-sans-ed text-sm text-ink md:text-base">
                  {rotulo}
                </span>
                <span className="flex items-center gap-1.5">
                  <IconCheck className="h-4 w-4 text-ink" />
                  <span className="sr-only">Aprovada</span>
                </span>
              </li>
            ))}

            {/* Pedidos — alerta com observação expandida */}
            <li className="px-5 py-4 pb-5 md:px-6">
              <div className="flex items-center justify-between gap-4">
                <span className="font-sans-ed text-sm text-ink md:text-base">
                  Pedidos
                </span>
                <span
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lacre font-mono-ed text-[11px] font-medium leading-none text-paper"
                  aria-hidden
                >
                  !
                </span>
                <span className="sr-only">
                  Atenção: pedidos com pendência
                </span>
              </div>

              <div className="mt-3 border-l-2 border-lacre bg-paper-2 px-4 py-3">
                <p className="font-mono-ed text-[10px] uppercase tracking-[0.18em] text-lacre">
                  Observação
                </p>
                <p className="mt-1 text-sm leading-relaxed text-ink-2">
                  Pedido de danos morais sem indicação de valor — incluir
                  estimativa.
                </p>
              </div>
            </li>

            <li className="flex items-center justify-between gap-4 px-5 py-4 md:px-6">
              <span className="font-sans-ed text-sm text-ink md:text-base">
                Jurisprudência
              </span>
              <span className="flex items-center gap-1.5">
                <IconCheck className="h-4 w-4 text-ink" />
                <span className="sr-only">Aprovada</span>
              </span>
            </li>

            <li className="flex items-center justify-between gap-4 px-5 py-4 md:px-6">
              <span className="font-sans-ed text-sm text-ink md:text-base">
                Contradições
              </span>
              <span className="flex items-center font-mono-ed text-sm leading-none text-lacre">
                <span className="sr-only">Localizadas: </span>
                <span aria-hidden>2</span>
              </span>
            </li>
          </ul>

          {/* Rodapé obrigatório — spec: nunca verdade jurídica absoluta */}
          <footer className="border-t border-ink/10 px-5 py-3.5 md:px-6">
            <p className="font-mono-ed text-[11px] leading-relaxed text-ink-3">
              Ferramenta auxiliar de revisão — a avaliação final é sempre do
              advogado.
            </p>
          </footer>
        </article>
      </Reveal>
    </Section>
  );
}
