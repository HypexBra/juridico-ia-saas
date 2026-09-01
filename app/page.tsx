import { ApiSection } from "@/components/marketing/api-section";
import { AuditSection } from "@/components/marketing/audit-section";
import { CaseSection } from "@/components/marketing/case-section";
import { ClientSection } from "@/components/marketing/client-section";
import { ContactSection } from "@/components/marketing/contact-section";
import { CtaFinal } from "@/components/marketing/cta-final";
import { DevilSection } from "@/components/marketing/devil-section";
import { DocumentsSection } from "@/components/marketing/documents-section";
import { Faq, FAQ_ENTRIES } from "@/components/marketing/faq";
import { FinancialSection } from "@/components/marketing/financial-section";
import { Footer } from "@/components/marketing/footer";
import { Hero } from "@/components/marketing/hero";
import { MemorySection } from "@/components/marketing/memory-section";
import { Nav } from "@/components/marketing/nav";
import { Pricing } from "@/components/marketing/pricing";
import { ProblemSection } from "@/components/marketing/problem-section";
import { ProactiveSection } from "@/components/marketing/proactive-section";
import { ReportsSection } from "@/components/marketing/reports-section";
import { ResearchSection } from "@/components/marketing/research-section";
import { ResultSection } from "@/components/marketing/result-section";
import { SecuritySection } from "@/components/marketing/security-section";
import { SignatureSection } from "@/components/marketing/signature-section";
import { SilverThread } from "@/components/marketing/silver-thread";
import { SocialProofSection } from "@/components/marketing/social-proof-section";
import { WhatsappSection } from "@/components/marketing/whatsapp-section";
import { WorkflowSection } from "@/components/marketing/workflow-section";
import { obterAppUrl } from "@/lib/app/url";

/**
 * `@graph` único combinando os 3 schemas (AEO/GEO — resposta direta em
 * buscadores de IA e no rich snippet do Google, não só SEO clássico):
 * SoftwareApplication (o produto), Organization (a empresa por trás, com
 * canal de contato real) e FAQPage (as mesmas perguntas de `<Faq>`, nunca
 * uma segunda lista divergente).
 */
function construirJsonLd(appUrl: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        "@id": `${appUrl}/#software`,
        name: "Jurídico IA",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description:
          "Sistema operacional inteligente para escritórios de advocacia: casos, documentos analisados, prazos monitorados no diário oficial, tarefas automáticas e portal do cliente.",
        inLanguage: "pt-BR",
        url: appUrl,
        offers: {
          "@type": "OfferAggregate",
          lowPrice: "0",
          highPrice: "149",
          priceCurrency: "BRL",
          offerCount: "2",
        },
      },
      {
        "@type": "Organization",
        "@id": `${appUrl}/#organization`,
        name: "Jurídico IA",
        url: appUrl,
        email: "pedrohenriquesanchesleal4@gmail.com",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Brasília",
          addressRegion: "DF",
          addressCountry: "BR",
        },
        areaServed: "BR",
      },
      {
        "@type": "FAQPage",
        "@id": `${appUrl}/#faq`,
        mainEntity: FAQ_ENTRIES.map((entry) => ({
          "@type": "Question",
          name: entry.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: entry.answer,
          },
        })),
      },
    ],
  };
}

export default function Home() {
  return (
    <div className="marketing-root flex min-h-full flex-1 flex-col overflow-x-hidden bg-paper font-sans-ed text-ink">
      <Nav />
      {/* O fio do caso (assinatura visual) costura todas as seções por trás;
          `relative` estabelece o stacking context que o -z-10 dele exige. */}
      <main id="conteudo" className="relative flex-1">
        <SilverThread />
        <Hero />
        <SocialProofSection />
        <ProblemSection />
        <CaseSection />
        <DocumentsSection />
        <AuditSection />
        <DevilSection />
        <WorkflowSection />
        <ProactiveSection />
        <ResearchSection />
        <ClientSection />
        <WhatsappSection />
        <MemorySection />
        <ResultSection />
        <Pricing />
        <SecuritySection />
        <FinancialSection />
        <ReportsSection />
        <SignatureSection />
        <ApiSection />
        <Faq />
        <ContactSection />
        <CtaFinal />
      </main>
      <Footer />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(construirJsonLd(obterAppUrl())) }}
      />
    </div>
  );
}
