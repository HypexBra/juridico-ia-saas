import { Reveal } from "./reveal";
import { Section } from "./section";

/**
 * Seção 15 · FINANCEIRO — baseada em `app/app/financeiro/` (page.tsx,
 * actions.ts, inadimplencia/, projecao-exito/). Recurso disponível em todos
 * os planos (sem chave em `lib/planos/gating.ts`), por isso nenhum selo
 * "Pro" aqui. Mostra só o que existe de verdade: contrato de honorário
 * (fixo/êxito/AAJ), rateio entre sócios, parcelas com controle de
 * pendente/atrasado/pago, painel de inadimplência, projeção de recebíveis de
 * êxito e exportação em CSV — nada de fluxo de caixa completo ou conciliação
 * bancária, que não existem no produto.
 */

interface LinhaResumoFinanceiro {
  readonly rotulo: string;
  readonly valor: string;
  readonly tom: "neutro" | "alerta";
  readonly nota: string;
}

const RESUMO: readonly LinhaResumoFinanceiro[] = [
  { rotulo: "Recebido no mês", valor: "R$ 18.400,00", tom: "neutro", nota: "Parcelas pagas com vencimento neste mês." },
  { rotulo: "A receber no mês", valor: "R$ 9.200,00", tom: "neutro", nota: "Parcelas pendentes ou atrasadas." },
  { rotulo: "Em atraso", valor: "R$ 3.150,00", tom: "alerta", nota: "2 parcelas vencidas sem pagamento." },
] as const;

const RATEIO = [
  { socio: "Sócio A", percentual: "60%" },
  { socio: "Sócio B", percentual: "40%" },
] as const;

export function FinancialSection() {
  return (
    <Section
      numero="15"
      kicker="FINANCEIRO"
      titulo={
        <>
          Honorário, rateio e <em>inadimplência</em> num só lugar.
        </>
      }
      intro="Contratos fixos, de êxito ou AAJ, com parcelas geradas automaticamente e divididas entre os sócios do escritório."
    >
      <div className="mx-auto max-w-2xl">
        <Reveal>
          <div className="grid gap-px overflow-hidden border border-ink/10 bg-ink/10 sm:grid-cols-3">
            {RESUMO.map((linha) => (
              <div key={linha.rotulo} className="bg-paper p-5">
                <p className="font-mono-ed text-[11px] uppercase tracking-[0.18em] text-ink-3">
                  {linha.rotulo}
                </p>
                <p
                  className={`mt-2 font-serif-ed text-2xl ${
                    linha.tom === "alerta" ? "text-accent" : "text-ink"
                  }`}
                >
                  {linha.valor}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-ink-3">{linha.nota}</p>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delayMs={100}>
          <div className="mt-px border border-t-0 border-ink/10 bg-paper-2 px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-mono-ed text-[11px] uppercase tracking-[0.18em] text-ink-3">
                Rateio do contrato · Indenização 0241
              </p>
              <span className="font-mono-ed text-[11px] text-ink-3">100%</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {RATEIO.map((item) => (
                <span
                  key={item.socio}
                  className="rounded-full border border-ink/20 px-3 py-1 font-mono-ed text-xs text-ink"
                >
                  {item.socio} · {item.percentual}
                </span>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delayMs={160}>
          <p className="mt-6 text-center font-mono-ed text-[11px] tracking-wide text-ink-3">
            Painel de inadimplência · Projeção de recebíveis de êxito · Exportação em CSV
          </p>
        </Reveal>
      </div>
    </Section>
  );
}
