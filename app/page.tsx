import { CtaFinal } from "@/components/marketing/cta-final";
import { Faq } from "@/components/marketing/faq";
import { Features } from "@/components/marketing/features";
import { Footer } from "@/components/marketing/footer";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Nav } from "@/components/marketing/nav";
import { Pricing } from "@/components/marketing/pricing";
import { TrustStrip } from "@/components/marketing/trust-strip";

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col overflow-x-hidden">
      <Nav />
      <main className="flex-1">
        <Hero />
        <TrustStrip />
        <Features />
        <HowItWorks />
        <Pricing />
        <Faq />
        <CtaFinal />
      </main>
      <Footer />
    </div>
  );
}
