import { Faq } from "@/components/landing/Faq";
import { Features } from "@/components/landing/Features";
import { FinalCta } from "@/components/landing/FinalCta";
import { Footer } from "@/components/landing/Footer";
import { ForEveryone } from "@/components/landing/ForEveryone";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LandingNav } from "@/components/landing/LandingNav";
import { Problem } from "@/components/landing/Problem";

// The public landing page. Each section lives in src/components/landing/.
export default function Home() {
  return (
    <>
      <LandingNav />
      <main className="flex-1">
        <Hero />
        <Problem />
        <HowItWorks />
        <Features />
        <ForEveryone />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
