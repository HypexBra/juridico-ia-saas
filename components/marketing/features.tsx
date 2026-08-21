import { FeaturesScroller } from "./features-scroller";
import { LightBeam } from "./light-beam";
import { Reveal } from "./reveal";
import {
  IconBanknote,
  IconClock,
  IconPortal,
  IconScale,
  IconSignature,
  IconTrendingUp,
  IconUsers,
  IconWhatsapp,
} from "./icons";
import type { ComponentType, SVGProps } from "react";

interface Article {
  numeral: string;
  title: string;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

// Curadoria deliberada: só as cláusulas essenciais aqui (o resto do produto
// — biblioteca de modelos, export DOCX/PDF, multi-usuário, score de risco,
// jurisprudência ampliada, e as 6 features Pro — continua real e disponível
// dentro do app, só não precisa de uma linha própria na landing pra não
// poluir a primeira impressão). Ver components/marketing/pricing.tsx pra o
// detalhamento completo por plano.
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
      "Envie um link público de triagem — até antes de virar cliente. Ele descreve o caso com suas próprias palavras e a IA já entrega ao advogado um resumo estruturado, as questões jurídicas envolvidas e uma estratégia sugerida.",
    icon: IconUsers,
  },
  {
    numeral: "Art. 3º",
    title: "Prazo automático via diário oficial",
    description:
      "O sistema varre o DJEN todos os dias procurando pelos processos cadastrados e lança o prazo sozinho no painel — ninguém precisa mais ler publicação por publicação à mão.",
    icon: IconClock,
  },
  {
    numeral: "Art. 4º",
    title: "Portal do cliente",
    description:
      "Cada cliente recebe um acesso próprio para acompanhar o andamento do caso, documentos e prazos. Antes mesmo do convite formal, ele já confere o status básico só com o CPF.",
    icon: IconPortal,
  },
  {
    numeral: "Art. 5º",
    title: "Financeiro de honorários",
    description:
      "Contratos de honorário e parcelas em um painel só: quem já pagou, quem está em atraso, quanto entra no mês — sem depender de planilha paralela.",
    icon: IconBanknote,
  },
  {
    numeral: "Art. 6º",
    title: "Assinatura eletrônica",
    description:
      "Envie contratos e petições para assinatura direto da plataforma, com validade jurídica, e acompanhe quem já assinou sem precisar sair do painel.",
    icon: IconSignature,
  },
  {
    numeral: "Art. 7º",
    title: "Lembrete automático via WhatsApp",
    description:
      "Prazo perto do fim ou parcela de honorário vencendo: o sistema dispara a mensagem sozinho, todos os dias, sem depender de alguém lembrar de avisar o cliente.",
    icon: IconWhatsapp,
  },
  {
    numeral: "Art. 8º",
    title: "Relatório de produtividade por advogado",
    description:
      "Casos, faturamento e taxa de êxito por advogado, num painel só — o sócio vê onde o escritório está ganhando e onde está perdendo tempo, sem montar planilha.",
    icon: IconTrendingUp,
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
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-silver">
            Funcionalidades
          </p>
          <h2 className="font-display text-3xl font-bold leading-tight text-ice sm:text-4xl">
            O contrato de serviço do seu novo associado
          </h2>
          <p className="mt-4 text-muted">
            Oito cláusulas essenciais, nenhuma promessa vazia — cada uma existe e funciona hoje.
          </p>
        </div>
      </div>

      {/* Desktop (>=1024px): pinned scrollytelling, one artigo por vez. */}
      <FeaturesScroller articles={scrollerArticles} />

      {/* Mobile/tablet + no-JS + reduced-motion fallback: lista estática empilhada,
          com leve alternância esquerda/direita (>=sm) para não ler como grid rígida. */}
      <div className="mx-auto max-w-5xl px-5 sm:px-8 lg:hidden">
        <div className="divide-y divide-silver/10 border-y border-silver/10">
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
                  <span className="font-display text-sm font-bold tracking-wide text-silver-2 sm:w-[90px] sm:shrink-0 sm:pt-1">
                    {article.numeral}
                  </span>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border border-silver/20 bg-silver/5 text-silver">
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
