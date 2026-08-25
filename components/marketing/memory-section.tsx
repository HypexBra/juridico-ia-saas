import { Reveal } from "./reveal";
import { Section } from "./section";

/* 11 · MEMÓRIA DO ESCRITÓRIO (spec v3 §6): o inventário "SEU ESCRITÓRIO"
   como tabela minimalista — rótulos à esquerda, descrição à direita,
   separada por hairlines. As linhas revelam em cascata leve (delayMs
   crescente), como um índice sendo preenchido. O rodapé afirma exatamente
   o que o produto faz: isolamento por escritório, nada além disso.
   Server Component puro (os únicos ilhotes client são os <Reveal>). */

interface LinhaInventario {
  readonly rotulo: string;
  readonly descricao: string;
}

const LINHAS_INVENTARIO: readonly LinhaInventario[] = [
  { rotulo: "Modelos", descricao: "14 peças com suas cláusulas padrão" },
  { rotulo: "Teses", descricao: "37 argumentos já usados pelo escritório" },
  { rotulo: "Preferências", descricao: "Tom formal · citação ABNT · português" },
  { rotulo: "Documentos", descricao: "212 analisados e indexados" },
  { rotulo: "Workflows", descricao: "3 fluxos ativos" },
  { rotulo: "Conhecimento", descricao: "Memória por caso e por escritório" },
] as const;

/** Passo da cascata entre linhas do inventário (ms). */
const PASSO_CASCATA_MS = 60;

export function MemorySection() {
  return (
    <Section
      numero="11"
      kicker="MEMÓRIA DO ESCRITÓRIO"
      titulo={
        <>
          Quanto mais você usa, mais o sistema{" "}
          <em className="italic">entende</em> como seu escritório trabalha.
        </>
      }
    >
      <div className="mx-auto max-w-2xl">
        <Reveal>
          <p className="font-mono-ed text-xs uppercase tracking-[0.2em] text-ink-3">
            SEU ESCRITÓRIO
          </p>
        </Reveal>

        <dl className="mt-5 divide-y divide-ink/10 border-y border-ink/10">
          {LINHAS_INVENTARIO.map((linha, index) => (
            <Reveal
              key={linha.rotulo}
              delayMs={index * PASSO_CASCATA_MS}
              className="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
            >
              <dt className="shrink-0 font-sans-ed text-base font-medium text-ink">
                {linha.rotulo}
              </dt>
              <dd className="text-sm leading-relaxed text-ink-2 sm:text-right">
                {linha.descricao}
              </dd>
            </Reveal>
          ))}
        </dl>

        {/* Fronteira de dados: a promessa de privacidade em uma linha */}
        <Reveal delayMs={LINHAS_INVENTARIO.length * PASSO_CASCATA_MS + 80}>
          <p className="mt-6 text-center font-mono-ed text-[11px] tracking-wide text-ink-3">
            Isolado por escritório — nenhum dado cruza a fronteira entre
            escritórios.
          </p>
        </Reveal>
      </div>
    </Section>
  );
}
