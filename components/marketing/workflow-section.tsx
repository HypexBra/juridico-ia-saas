import { Reveal } from "./reveal";
import { Section } from "./section";

/**
 * Seção 06 · AUTOMAÇÃO — stepper vertical dos 8 passos do fluxo de trabalho,
 * preenchido progressivamente no scroll (docs/redesign-landing-v3.md §6).
 *
 * Decisão de motion (a mais simples e robusta para o caso): CSS scroll-driven
 * puro — `@supports (animation-timeline: view())` anima apenas
 * background/border dos nós (propriedades baratas, sem geometria recalculada),
 * dentro de `prefers-reduced-motion: no-preference`. Sem ScrollTrigger aqui:
 * zero JS cliente neste componente (Server Component puro), nenhum risco de
 * trigger órfão e o conteúdo é 100% visível mesmo sem suporte (fallback
 * estático = nós vazios + texto integral). Em reduced-motion os nós ficam
 * estáticos já no estado final (preenchidos em lacre).
 */

interface PassoFluxo {
  /** Índice mono exibido ("01"…"08"). */
  indice: string;
  /** Nome da etapa do fluxo. */
  nome: string;
  /** Uma linha dizendo o que a etapa automatiza. */
  descricao: string;
}

/** Os 8 passos na ordem exata da spec §6. */
const PASSOS: readonly PassoFluxo[] = [
  {
    indice: "01",
    nome: "Novo cliente",
    descricao: "Ficha criada com contexto completo em segundos.",
  },
  {
    indice: "02",
    nome: "Triagem",
    descricao: "Perguntas certas, classificação de área e urgência.",
  },
  {
    indice: "03",
    nome: "Documentos",
    descricao: "Solicitação e recebimento organizados por caso.",
  },
  {
    indice: "04",
    nome: "Análise",
    descricao: "Resumo, partes, teses e riscos extraídos do processo.",
  },
  {
    indice: "05",
    nome: "Estratégia",
    descricao: "Teses, provas e próximos passos organizados.",
  },
  {
    indice: "06",
    nome: "Documento",
    descricao: "Modelos do escritório preenchidos pelo contexto do caso.",
  },
  {
    indice: "07",
    nome: "Revisão",
    descricao: "Auditoria automática antes de você assinar.",
  },
  {
    indice: "08",
    nome: "Prazo",
    descricao: "Datas calculadas e monitoradas no diário oficial.",
  },
] as const;

/**
 * Estilos escopados do stepper (prefixo `jur-wf-`). O preenchimento dos nós
 * acompanha a própria posição de cada item na viewport (`view()`): o nó entra
 * vazio e ganha bg/borda lacre ao atravessar os primeiros 45% da tela.
 * Sem suporte ou com reduced-motion: regras não se aplicam — nós estáticos
 * (reduced-motion recebe o estado final diretamente).
 */
const STEPPER_CSS = `
@media (prefers-reduced-motion: no-preference) {
  @supports (animation-timeline: view()) {
    .jur-wf-no {
      animation: jur-wf-preencher linear both;
      animation-timeline: view();
      animation-range: cover 5% cover 45%;
    }
    @keyframes jur-wf-preencher {
      from {
        background-color: #faf9f5;
        border-color: rgb(20 20 18 / 0.25);
      }
      to {
        background-color: var(--color-lacre);
        border-color: var(--color-lacre);
      }
    }
  }
}
@media (prefers-reduced-motion: reduce) {
  .jur-wf-no {
    background-color: var(--color-lacre);
    border-color: var(--color-lacre);
  }
}
`;

export function WorkflowSection() {
  return (
    <Section
      id="como-funciona"
      numero="06"
      kicker="AUTOMAÇÃO"
      titulo={
        <>
          O trabalho que você não precisa mais <em>lembrar</em> de fazer.
        </>
      }
    >
      {/* Folha de estilo escopada — ver STEPPER_CSS acima. */}
      <style dangerouslySetInnerHTML={{ __html: STEPPER_CSS }} />

      <ol className="max-w-2xl">
        {PASSOS.map(({ indice, nome, descricao }, i) => (
          <li
            key={indice}
            className={`relative border-l border-ink/15 pb-12 pl-8 last:border-transparent last:pb-0 md:pl-10 ${
              i === 0 ? "" : "pt-1"
            }`}
          >
            {/* Nó do fio — ornamento puro (a ordem já é semântica do <ol>) */}
            <span
              aria-hidden
              className="jur-wf-no absolute left-0 top-1 block h-2.5 w-2.5 -translate-x-1/2 rounded-full border border-ink/25 bg-paper"
            />
            <p className="font-mono-ed text-[11px] tracking-wide text-ink-3">
              {indice}
            </p>
            <h3 className="mt-1 font-sans-ed text-lg font-medium text-ink">
              {nome}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-ink-2">
              {descricao}
            </p>
          </li>
        ))}
      </ol>

      <Reveal>
        <p className="mt-14 max-w-prose text-lg leading-relaxed text-ink-2 md:mt-16">
          Cada etapa pode criar tarefas, gerar documentos e abrir prazos —
          sempre com sua aprovação antes de qualquer ação externa.
        </p>
      </Reveal>
    </Section>
  );
}
