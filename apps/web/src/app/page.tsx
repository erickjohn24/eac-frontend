import Image from "next/image";
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
      <section className="relative z-10 mx-auto max-w-4xl px-5 pb-16 pt-14 text-center sm:pt-20">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-tz-400/30 bg-tz-500/10 px-4 py-1.5 text-[0.8rem] text-tz-300">
          <Sparkles className="size-3.5" /> AI agents on the real government portals
        </div>
        <h1 className="text-balance text-[2.8rem] font-medium leading-[1.05] sm:text-[4.2rem]">
          Start a Tanzanian company,
          <br />
          <span className="tz-gradient-text">then never think about compliance.</span>
        </h1>
        <TextGenerateEffect
          words="Our agents file with BRELA, TRA and every portal for you. You approve payments from your phone and show up once for biometrics — we handle the rest, then keep you compliant, forever."
          className="mx-auto mt-6 max-w-2xl text-balance text-[1.08rem] leading-relaxed text-fg-muted"
        />
        <div className="mt-9 flex items-center justify-center">
          <Link href="/onboarding">
            <MovingBorderButton className="tz-gradient border-0 text-white">
              Register your company <ArrowRight className="size-4" />
            </MovingBorderButton>
          </Link>
        </div>
        <p className="mt-4 text-[0.82rem] text-fg-faint">
          About 4 minutes. No account needed to start.
        </p>
      </section>

      {/* product showcase */}
      <section className="relative z-10 mx-auto max-w-5xl px-5 pb-20">
        <div className="relative">
          <div
            className="absolute -inset-6 rounded-[2rem] opacity-40 blur-3xl"
            style={{
              background:
                "radial-gradient(50% 60% at 50% 40%, rgba(124,107,245,0.35), transparent 70%)",
            }}
          />
          <div className="relative overflow-hidden rounded-[var(--radius-xl)] border border-hairline-2 bg-panel shadow-[var(--shadow-soft)]">
            <div className="flex items-center gap-1.5 border-b border-hairline bg-panel-2 px-4 py-3">
              <span className="size-2.5 rounded-full bg-hairline-2" />
              <span className="size-2.5 rounded-full bg-hairline-2" />
              <span className="size-2.5 rounded-full bg-hairline-2" />
              <span className="ml-3 rounded-md bg-bg-2 px-3 py-1 text-[0.7rem] text-fg-faint">
                tzcompliance.app/onboarding
              </span>
            </div>
            <Image
              src="/product-vision.jpg"
              alt="The tz-compliance onboarding: AI reads your business description and prepares your registration"
              width={2160}
              height={1440}
              priority
              className="block w-full"
            />
          </div>
        </div>
      </section>

      {/* how it works */}
      <section className="relative z-10 mx-auto max-w-5xl px-5 pb-20">
        <p className="text-eyebrow text-center">How it works</p>
        <h2 className="mt-3 text-center font-display text-[1.8rem] leading-tight sm:text-[2.2rem]">
          You talk. We file. <span className="tz-gradient-text">Tanzania opens for business.</span>
        </h2>
        <div className="mt-10 grid gap-8 sm:grid-cols-3">
          {[
            {
              n: "01",
              title: "Tell us your vision",
              body: "Plain language in — registered activities, company objects and available names out. Never fill a form you don't have to.",
            },
            {
              n: "02",
              title: "Sign & approve from your phone",
              body: "Documents prepared the way BRELA expects, each signer gets their own link, and every government fee is one mobile-money tap.",
            },
            {
              n: "03",
              title: "We file and track everything",
              body: "Certificate, TIN, licence, bank pack and stamp — with honest timelines at every step, and your compliance calendar live from day one.",
            },
          ].map((s) => (
            <div key={s.n} className="relative">
              <span className="tnum font-display text-[2.6rem] leading-none text-tz-500/35">{s.n}</span>
              <h3 className="mt-3 text-[1.05rem] font-semibold">{s.title}</h3>
              <p className="mt-2 text-[0.9rem] leading-relaxed text-fg-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* value props */}
      <section className="relative z-10 mx-auto max-w-5xl px-5 pb-20">
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
                "BRELA incorporation, TRA tax, licences, NSSF, WCF and OSHA, bank pack and stamp — orchestrated end to end.",
            },
            {
              icon: <ShieldCheck className="size-5 text-tz-300" />,
              title: "Compliant on autopilot",
              description:
                "Annual returns, VAT, PAYE, contributions and renewals — tracked, reminded and filed before they're ever late.",
            },
          ]}
        />
      </section>

      {/* closing CTA */}
      <section className="relative z-10 mx-auto max-w-3xl px-5 pb-24 text-center">
        <div className="card relative overflow-hidden p-10">
          <div className="absolute inset-x-0 top-0 h-1 tz-gradient" />
          <h2 className="font-display text-[1.7rem] leading-tight sm:text-[2rem]">
            Your company could be filing at BRELA
            <br className="hidden sm:block" /> before you finish your chai.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[0.95rem] text-fg-muted">
            Four steps, about four minutes — and you can save and finish any time,
            on any device.
          </p>
          <div className="mt-7 flex justify-center">
            <Link href="/onboarding">
              <Button size="lg">
                Register your company <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* footer */}
      <footer className="relative z-10 border-t border-hairline">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-5 py-10 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="tz-gradient grid size-7 place-items-center rounded-lg text-white">
                <span className="font-display text-base font-semibold">t</span>
              </div>
              <span className="font-display text-base font-medium">tz-compliance</span>
            </div>
            <p className="mt-3 max-w-md text-[0.78rem] leading-relaxed text-fg-faint">
              We're not a law firm, and this isn't legal advice. But every filing we
              prepare follows BRELA and TRA requirements exactly — and when your
              situation needs an advocate, we'll say so.
            </p>
          </div>
          <div className="flex gap-8 text-[0.82rem] text-fg-muted">
            <div className="space-y-2">
              <p className="text-label">Product</p>
              <Link href="/onboarding" className="block hover:text-fg">Register a company</Link>
              <Link href="/dashboard" className="block hover:text-fg">Dashboard</Link>
            </div>
            <div className="space-y-2">
              <p className="text-label">Contact</p>
              <a href="mailto:karibu@tzcompliance.app" className="block hover:text-fg">
                karibu@tzcompliance.app
              </a>
              <span className="block text-fg-faint">Dar es Salaam, Tanzania</span>
            </div>
          </div>
        </div>
        <div className="border-t border-hairline py-4 text-center text-[0.72rem] text-fg-faint">
          © {new Date().getFullYear()} tz-compliance · Made for wajasiriamali
        </div>
      </footer>
    </main>
  );
}
