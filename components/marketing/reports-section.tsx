import { Reveal } from "./reveal";
import { Section } from "./section";

/**
 * Seção 16 · RELATÓRIOS: baseada em `app/app/relatorios/page.tsx` e
 * `lib/relatorios/avancado.ts`. O relatório BASE (produtividade por
 * advogado: casos, prazos cumpridos/atrasados, honorários gerados/recebidos
 * via rateio) é livre em todo plano. O breakdown de "realization rate"
 * (recebido / contratado) por caso e área do direito é a feature
 * `relatorios_avancados` (`lib/planos/gating.ts`), Pro-only, com selo
 * explícito abaixo. Nunca chamado de "dashboard de BI": é um relatório de
 * produtividade, e o próprio código documenta que não há taxa de êxito no
 * schema atual. Texto aqui reflete essa limitação real, não promete o que
 * falta.
 */

interface LinhaProdutividadeMock {
  readonly nome: string;
  readonly casos: number;
  readonly cumpridos: number;
  readonly atrasados: number;
  readonly recebido: string;
}

const LINHAS: readonly LinhaProdutividadeMock[] = [
  { nome: "Marina Alves", casos: 14, cumpridos: 22, atrasados: 1, recebido: "R$ 12.900" },
  { nome: "Rafael Costa", casos: 9, cumpridos: 15, atrasados: 3, recebido: "R$ 7.400" },
] as const;

export function ReportsSection() {
  return (
    <Section
      numero="16"
      kicker="RELATÓRIOS"
      titulo={
        <>
          Quem está produzindo. <em>Com números.</em>
        </>
      }
      intro="Relatório de produtividade por advogado: casos atribuídos, prazos cumpridos e atrasados, honorários gerados e recebidos pelo rateio de cada sócio."
    >
      <div className="mx-auto max-w-2xl">
        <Reveal>
          <div className="border border-ink/10 bg-paper">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 border-b border-ink/10 px-5 py-3 font-mono-ed text-[10px] uppercase tracking-[0.16em] text-ink-3 sm:px-6">
              <span>Advogado</span>
              <span className="text-right">Casos</span>
              <span className="text-right">Cumpridos</span>
              <span className="text-right">Atrasados</span>
            </div>
            <ul className="divide-y divide-ink/10">
              {LINHAS.map((linha) => (
                <li
                  key={linha.nome}
                  className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 px-5 py-3.5 sm:px-6"
                >
                  <span className="min-w-0 truncate font-sans-ed text-sm text-ink">{linha.nome}</span>
                  <span className="text-right font-mono-ed text-sm text-ink">{linha.casos}</span>
                  <span className="text-right font-mono-ed text-sm text-ink">{linha.cumpridos}</span>
                  <span className="text-right font-mono-ed text-sm text-accent">{linha.atrasados}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        <Reveal delayMs={100}>
          <div className="mt-px border border-ink/10 bg-paper-2 px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-ink/25 px-2.5 py-0.5 font-mono-ed text-[10px] uppercase tracking-[0.16em] text-ink">
                Pro
              </span>
              <p className="font-mono-ed text-[11px] uppercase tracking-[0.18em] text-ink-3">
                Realization rate por caso e por área do direito
              </p>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">
              Recebido dividido por contratado, com breakdown financeiro por
              caso e por área do direito.
            </p>
          </div>
        </Reveal>

        <Reveal delayMs={160}>
          <p className="mt-6 max-w-prose text-sm leading-relaxed text-ink-3">
            Honestidade de escopo: este relatório mede produtividade e
            financeiro, não resultado processual. O schema atual não guarda
            desfecho de caso (ganho/perdido). Não há taxa de êxito aqui.
          </p>
        </Reveal>
      </div>
    </Section>
  );
}
