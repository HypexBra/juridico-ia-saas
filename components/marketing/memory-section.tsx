import { Reveal } from "./reveal";
import { Section } from "./section";
import { IconPlus } from "./icons";

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

        {/* Nota técnica: o isolamento também cobre a camada vetorial (RAG),
            não só as tabelas relacionais — afirmação correspondente à policy
            `embeddings_chunks_isolamento` (migration 0002_rag_e_propostas.sql). */}
        <Reveal delayMs={LINHAS_INVENTARIO.length * PASSO_CASCATA_MS + 140}>
          <details className="faq-suave group mt-4 border-t border-ink/10">
            <summary className="flex cursor-pointer list-none items-center justify-center gap-2 py-4 text-center font-mono-ed text-[11px] tracking-wide text-ink-3 transition-colors hover:text-ink [&::-webkit-details-marker]:hidden">
              O isolamento cobre também a busca por similaridade?
              <IconPlus className="h-3.5 w-3.5 shrink-0 transition-transform duration-300 ease-out group-open:rotate-45" />
            </summary>
            <p className="mx-auto max-w-prose pb-5 text-center text-xs leading-relaxed text-ink-2">
              Sim. A memória do escritório também é armazenada como vetores
              (embeddings) para permitir busca por significado, não só por
              palavra-chave — e essa tabela tem sua própria política de Row
              Level Security por escritório, separada das tabelas relacionais.
              Uma consulta vetorial de um escritório nunca retorna trechos de
              outro.
            </p>
          </details>
        </Reveal>
      </div>
    </Section>
  );
}
