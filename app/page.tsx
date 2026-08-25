import { AuditSection } from "@/components/marketing/audit-section";
import { CaseSection } from "@/components/marketing/case-section";
import { ClientSection } from "@/components/marketing/client-section";
import { ContactSection } from "@/components/marketing/contact-section";
import { CtaFinal } from "@/components/marketing/cta-final";
import { DevilSection } from "@/components/marketing/devil-section";
import { DocumentsSection } from "@/components/marketing/documents-section";
import { Faq } from "@/components/marketing/faq";
import { Footer } from "@/components/marketing/footer";
import { Hero } from "@/components/marketing/hero";
import { MemorySection } from "@/components/marketing/memory-section";
import { Nav } from "@/components/marketing/nav";
import { Pricing } from "@/components/marketing/pricing";
import { ProblemSection } from "@/components/marketing/problem-section";
import { ProactiveSection } from "@/components/marketing/proactive-section";
import { ResearchSection } from "@/components/marketing/research-section";
import { ResultSection } from "@/components/marketing/result-section";
import { SecuritySection } from "@/components/marketing/security-section";
import { SilverThread } from "@/components/marketing/silver-thread";
import { WhatsappSection } from "@/components/marketing/whatsapp-section";
import { WorkflowSection } from "@/components/marketing/workflow-section";

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Jurídico IA",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Sistema operacional inteligente para escritórios de advocacia: casos, documentos analisados, prazos monitorados no diário oficial, tarefas automáticas e portal do cliente.",
  inLanguage: "pt-BR",
  offers: {
    "@type": "OfferAggregate",
    lowPrice: "0",
    highPrice: "149",
    priceCurrency: "BRL",
    offerCount: "2",
  },
};

export default function Home() {
  return (
    <div className="marketing-root flex min-h-full flex-1 flex-col overflow-x-hidden bg-paper font-sans-ed text-ink">
      <Nav />
      {/* O fio do caso (assinatura visual) costura todas as seções por trás;
          `relative` estabelece o stacking context que o -z-10 dele exige. */}
      <main id="conteudo" className="relative flex-1">
        <SilverThread />
        <Hero />
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
        <Faq />
        <ContactSection />
        <CtaFinal />
      </main>
      <Footer />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
    </div>
  );
}
