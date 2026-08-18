import { FeaturesScroller } from "./features-scroller";
import { LightBeam } from "./light-beam";
import { Reveal } from "./reveal";
import {
  IconChart,
  IconClipboard,
  IconClock,
  IconDownload,
  IconLibrary,
  IconScale,
  IconUsers,
} from "./icons";
import type { ComponentType, SVGProps } from "react";

interface Article {
  numeral: string;
  title: string;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const ARTICLES: Article[] = [
  {
    numeral: "Art. 1º",
    title: "Chat jurídico com fundamentação real",
    description:
      "Gere petições, contratos, pareceres e análises de caso fundamentados na CF, CC, CPC e súmulas do STF e STJ. Quando não há certeza sobre um precedente, a IA sinaliza — nunca inventa jurisprudência.",
    icon: IconScale,
  },
  {
    numeral: "Art. 2º",
    title: "Triagem de clientes guiada",
    description:
      "Envie um formulário guiado ao cliente. Ele descreve o caso com suas próprias palavras e a IA já entrega ao advogado um resumo estruturado, as questões jurídicas envolvidas e uma estratégia sugerida.",
    icon: IconUsers,
  },
  {
    numeral: "Art. 3º",
    title: "Controle de prazos processuais",
    description:
      "Uma lista de vencimentos por processo, visível no painel, para que nenhuma contestação, recurso ou manifestação perca o prazo por falta de acompanhamento manual.",
    icon: IconClock,
  },
  {
    numeral: "Art. 4º",
    title: "Biblioteca de modelos",
    description:
      "Salve as peças e cláusulas que o escritório já validou. A IA reaproveita esses modelos como ponto de partida, mantendo o padrão de linguagem da banca em cada novo documento.",
    icon: IconLibrary,
  },
  {
    numeral: "Art. 5º",
    title: "Exportação em DOCX e PDF",
    description:
      "O que sai do chat chega pronto para revisão: baixe qualquer petição, contrato ou parecer em Word ou PDF, formatado, sem retrabalho de diagramação.",
    icon: IconDownload,
  },
  {
    numeral: "Art. 6º",
    title: "Financeiro do uso de IA",
    description:
      "Um painel simples mostra quanto do limite mensal de IA já foi consumido pelo escritório, por advogado e por tipo de documento gerado.",
    icon: IconChart,
  },
  {
    numeral: "Art. 7º",
    title: "Multi-usuário por escritório",
    description:
      "Convide os advogados do seu time para a mesma conta. Cada um trabalha com seus próprios casos, sob o mesmo painel e a mesma biblioteca de modelos.",
    icon: IconClipboard,
  },
];

export function Features() {
  // Rendered once here (Server Component) so the client scroller only ever
  // receives plain ReactNode icons — no function references cross the RSC
  // boundary.
  const scrollerArticles = ARTICLES.map(({ icon: Icon, ...rest }) => ({
    ...rest,
    icon: <Icon className="h-6 w-6" strokeWidth={1.4} />,
  }));

  return (
    <section id="funcionalidades" className="relative overflow-hidden py-24 sm:py-32">
      <LightBeam angle={-16} origin="top-left" className="-z-10" />
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <div className="mb-16 max-w-xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-gold">
            Funcionalidades
          </p>
          <h2 className="font-display text-3xl font-bold leading-tight text-ice sm:text-4xl">
            O contrato de serviço do seu novo associado
          </h2>
          <p className="mt-4 text-muted">
            Sete cláusulas, nenhuma promessa vazia — cada uma existe e funciona hoje.
          </p>
        </div>
      </div>

      {/* Desktop (>=1024px): pinned scrollytelling, one artigo por vez. */}
      <FeaturesScroller articles={scrollerArticles} />

      {/* Mobile/tablet + no-JS + reduced-motion fallback: lista estática empilhada,
          com leve alternância esquerda/direita (>=sm) para não ler como grid rígida. */}
      <div className="mx-auto max-w-5xl px-5 sm:px-8 lg:hidden">
        <div className="divide-y divide-gold/10 border-y border-gold/10">
          {ARTICLES.map((article, index) => {
            const Icon = article.icon;
            const alignRight = index % 2 === 1;
            return (
              <Reveal key={article.numeral} delayMs={index * 60}>
                <div
                  className={`flex flex-col gap-4 py-8 sm:flex-row sm:items-start sm:gap-6 ${
                    alignRight ? "sm:flex-row-reverse sm:text-right" : ""
                  }`}
                >
                  <span className="font-display text-sm font-bold tracking-wide text-gold-2 sm:w-[90px] sm:shrink-0 sm:pt-1">
                    {article.numeral}
                  </span>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border border-gold/20 bg-gold/5 text-gold">
                    <Icon className="h-5 w-5" strokeWidth={1.4} />
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-bold text-ice">
                      {article.title}
                    </h3>
                    <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">
                      {article.description}
                    </p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
