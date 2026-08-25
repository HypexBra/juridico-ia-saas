import { IconPlus } from "./icons";

/* FAQ da landing em tema papel: <details>/<summary> NATIVOS (navegáveis
   por teclado sem JS), hairline ink/10 por item e IconPlus girando 45°
   no estado aberto via group-open:. Server Component — zero JS.

   Perguntas auditadas contra as verdades do produto (spec v3 §7):
   mantidas apenas afirmações reais hoje. Removidos os pares sobre
   exportação DOCX/PDF (não implementado) e convites de equipe (desatualizado);
   a resposta sobre limites foi corrigida — o Pro já existe (R$ 149/mês). */

interface FaqEntry {
  readonly question: string;
  readonly answer: string;
}

const FAQ_ENTRIES: readonly FaqEntry[] = [
  {
    question: "A IA inventa artigos de lei ou jurisprudência?",
    answer:
      "Não. O sistema é instruído a nunca inventar leis, súmulas ou precedentes — e resposta sem fonte verificável não entra na página. Quando não há certeza sobre um ponto, ele sinaliza isso claramente em vez de preencher a lacuna com algo inventado.",
  },
  {
    question: "As peças geradas substituem a revisão do advogado?",
    answer:
      "Não. O Jurídico IA produz a minuta e a fundamentação, mas a responsabilidade pela revisão, pelos ajustes e pela assinatura continua sendo do advogado — como acontece com qualquer associado. É uma ferramenta auxiliar; a revisão final é sempre sua.",
  },
  {
    question: "Como funcionam os prazos encontrados automaticamente?",
    answer:
      "O sistema monitora publicações no DJEN, o Diário de Justiça Eletrônico Nacional, ligadas aos seus processos, identifica os prazos e cria as tarefas correspondentes. Você acompanha tudo na linha do tempo do caso, sem precisar ler o diário na mão.",
  },
  {
    question: "O plano Free tem limite de uso de IA?",
    answer:
      "Sim. O Free inclui um limite mensal de uso de IA, suficiente para conhecer o produto no dia a dia. O plano Pro custa R$ 149/mês e amplia o limite para escritórios com maior volume.",
  },
  {
    question: "Meus dados e os dos meus clientes ficam seguros?",
    answer:
      "Sim. Cada escritório opera em um ambiente isolado, com permissões por equipe e registro de acessos. Os dados dos seus casos não são usados para treinar modelos de IA, e você tem controle sobre eles.",
  },
] as const;

export function Faq() {
  return (
    <section id="faq" className="py-24 md:py-36">
      <div className="mx-auto max-w-6xl px-5 md:px-10">
        {/* Gramática editorial: kicker mono à esquerda, conteúdo dominante à direita */}
        <div className="grid gap-10 md:grid-cols-4 md:gap-16">
          <div>
            <p className="font-mono-ed text-xs uppercase tracking-[0.2em] text-ink-3">Dúvidas</p>
            <h2 className="mt-4 font-serif-ed text-3xl leading-[1.05] tracking-tight text-ink md:text-4xl">
              Perguntas frequentes
            </h2>
          </div>

          <div className="md:col-span-3">
            <div className="border-b border-ink/10">
              {FAQ_ENTRIES.map((entry) => (
                <details key={entry.question} className="faq-suave group border-t border-ink/10">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left font-sans-ed text-base text-ink-2 transition-colors hover:text-ink md:text-lg [&::-webkit-details-marker]:hidden">
                    {entry.question}
                    <IconPlus className="h-4 w-4 shrink-0 text-ink-3 transition-transform duration-300 ease-out group-open:rotate-45" />
                  </summary>
                  <div className="max-w-prose pb-6 pr-8 text-base leading-relaxed text-ink-2">
                    {entry.answer}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Aprimoramento progressivo: onde o browser suporta interpolate-size +
          ::details-content, abrir/fechar ganha transição suave de altura;
          sem suporte, o toggle nativo instantâneo permanece (acessível igual). */}
      <style>{`
        @supports (interpolate-size: allow-keywords) {
          .faq-suave {
            interpolate-size: allow-keywords;
          }
          .faq-suave::details-content {
            display: block;
            block-size: 0;
            overflow-y: clip;
            transition:
              block-size 0.32s ease,
              content-visibility 0.32s allow-discrete;
          }
          .faq-suave[open]::details-content {
            block-size: auto;
          }
        }
      `}</style>
    </section>
  );
}
