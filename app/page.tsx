import { CaseTimelineSpine } from "@/components/marketing/case-timeline-spine";
import { CtaFinal } from "@/components/marketing/cta-final";
import { Faq } from "@/components/marketing/faq";
import { Footer } from "@/components/marketing/footer";
import { Hero } from "@/components/marketing/hero";
import { Nav } from "@/components/marketing/nav";
import { Pricing } from "@/components/marketing/pricing";
import { SectionAdversarialAnalysis } from "@/components/marketing/section-adversarial-analysis";
import { SectionCaseSystem } from "@/components/marketing/section-case-system";
import { SectionClientPortal } from "@/components/marketing/section-client-portal";
import { SectionContextIntelligence } from "@/components/marketing/section-context-intelligence";
import { SectionDocumentAudit } from "@/components/marketing/section-document-audit";
import { SectionFirmMemory } from "@/components/marketing/section-firm-memory";
import { SectionLegalResearch } from "@/components/marketing/section-legal-research";
import { SectionProblem } from "@/components/marketing/section-problem";
import { SectionProactiveBriefing } from "@/components/marketing/section-proactive-briefing";
import { SectionReviewGate } from "@/components/marketing/section-review-gate";
import { SectionSecurity } from "@/components/marketing/section-security";
import { SectionTransformation } from "@/components/marketing/section-transformation";
import { SectionWhatsappSync } from "@/components/marketing/section-whatsapp-sync";
import { SectionWorkflowAutomation } from "@/components/marketing/section-workflow-automation";
import { TrustStrip } from "@/components/marketing/trust-strip";

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col overflow-x-hidden bg-[#070c16] text-ice selection:bg-silver/20 selection:text-ice">
      <Nav />
      <CaseTimelineSpine />
      <main className="relative flex-1">
        <Hero />
        <TrustStrip />
        <SectionProblem />
        <SectionCaseSystem />
        <SectionContextIntelligence />
        <SectionDocumentAudit />
        <SectionReviewGate />
        <SectionAdversarialAnalysis />
        <SectionWorkflowAutomation />
        <SectionProactiveBriefing />
        <SectionLegalResearch />
        <SectionClientPortal />
        <SectionWhatsappSync />
        <SectionFirmMemory />
        <SectionTransformation />
        <Pricing />
        <SectionSecurity />
        <Faq />
        <CtaFinal />
      </main>
      <Footer />
    </div>
  );
}
