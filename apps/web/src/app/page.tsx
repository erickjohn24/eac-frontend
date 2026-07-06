import Link from "next/link";
import { ArrowRight, Building2, ScanFace, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spotlight } from "@/components/ui/aceternity/spotlight";
import { TextGenerateEffect } from "@/components/ui/aceternity/text-generate-effect";
import { MovingBorderButton } from "@/components/ui/aceternity/moving-border";
import { HoverEffect } from "@/components/ui/aceternity/hover-effect";

export default function Home() {
  return (
    <main className="relative min-h-dvh overflow-hidden grain">
      <Spotlight className="-top-40 left-0 md:-top-20 md:left-60" fill="#7c6bf5" />
      <div className="aurora" />

      {/* nav */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <div className="flex items-center gap-2.5">
          <div className="tz-gradient grid size-8 place-items-center rounded-lg text-white shadow-[var(--shadow-glow)]">
            <span className="font-display text-lg font-semibold">t</span>
          </div>
          <span className="font-display text-lg font-medium tracking-tight">tz-compliance</span>
        </div>
        <Link href="/onboarding">
          <Button variant="secondary" size="sm">
            Start now
          </Button>
        </Link>
      </header>

      {/* hero */}
      <section className="relative z-10 mx-auto max-w-4xl px-5 pb-20 pt-16 text-center sm:pt-24">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-tz-400/30 bg-tz-500/10 px-4 py-1.5 text-[0.8rem] text-tz-300">
          <Sparkles className="size-3.5" /> Powered by agentic AI on the real government portals
        </div>
        <h1 className="text-balance text-[2.8rem] font-medium leading-[1.05] sm:text-[4.2rem]">
          Start a Tanzanian company,
          <br />
          <span className="tz-gradient-text">then never think about compliance.</span>
        </h1>
        <TextGenerateEffect
          words="From name reservation to bank account and company stamp, our AI drives BRELA, TRA and every portal for you. You do only what the law requires of you personally. Then we keep you compliant, forever."
          className="mx-auto mt-6 max-w-2xl text-balance text-[1.1rem] leading-relaxed text-fg-muted"
        />
        <div className="mt-9 flex items-center justify-center">
          <Link href="/onboarding">
            <MovingBorderButton>
              Register your company <ArrowRight className="size-4" />
            </MovingBorderButton>
          </Link>
        </div>
        <p className="mt-4 text-[0.82rem] text-fg-faint">Takes about 4 minutes. No account needed to start.</p>
      </section>

      {/* value props */}
      <section className="relative z-10 mx-auto max-w-5xl px-5 pb-24">
        <HoverEffect
          items={[
            {
              icon: <ScanFace className="size-5 text-tz-300" />,
              title: "Never asked twice",
              description:
                "Enter a National ID and NIDA fills the rest. Verify a TIN once. One person, many roles — zero duplicate forms.",
            },
            {
              icon: <Building2 className="size-5 text-tz-300" />,
              title: "The full pipeline",
              description:
                "BRELA incorporation, TRA tax, licences, NSSF/WCF/OSHA, bank pack and stamp — orchestrated end to end.",
            },
            {
              icon: <ShieldCheck className="size-5 text-tz-300" />,
              title: "Compliant on autopilot",
              description:
                "Annual returns, VAT, PAYE, contributions and renewals — tracked, reminded and filed automatically.",
            },
          ]}
        />
      </section>
    </main>
  );
}
