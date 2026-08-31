import { HeroSection } from "@/components/landing/hero/hero-section";
import { BonziShowcase } from "@/components/landing/bonzi-showcase";
import { AnalyzerWalkthrough } from "@/components/landing/analyzer-walkthrough";
import { LandingFooter } from "@/components/landing/landing-footer";
import { BonziCompanion } from "@/components/landing/bonzi-companion";

export default function LandingPage() {
  return (
    <main>
      <HeroSection />
      <div className="grid gap-20 py-20">
        <BonziShowcase />
        <AnalyzerWalkthrough />
      </div>
      <LandingFooter />
      <BonziCompanion />
    </main>
  );
}
