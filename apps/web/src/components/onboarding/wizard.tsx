"use client";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { emptyState, type OnboardingState } from "@/lib/onboarding-types";
import { StepVision } from "./step-vision";
import { StepCompany } from "./step-company";
import { StepPeople } from "./step-people";
import { StepReview } from "./step-review";
import { LivePreview } from "./live-preview";
import { BackgroundGradient } from "@/components/ui/aceternity/background-gradient";

const STEPS = [
  { id: "vision", label: "Vision", title: "What are you building?" },
  { id: "company", label: "Company", title: "Your company, defined" },
  { id: "people", label: "People", title: "Who's behind it" },
  { id: "review", label: "Launch", title: "Review & launch" },
] as const;

export function Wizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [state, setState] = useState<OnboardingState>(emptyState);
  const [submitting, setSubmitting] = useState(false);

  const patch = (p: Partial<OnboardingState>) => setState((s) => ({ ...s, ...p }));

  const canAdvance = useMemo(() => validate(step, state), [step, state]);

  function go(next: number) {
    setDir(next > step ? 1 : -1);
    setStep(Math.max(0, Math.min(STEPS.length - 1, next)));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function launch() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(state),
      });
      const { id } = await res.json();
      router.push(`/launched?id=${id}`);
    } catch {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-dvh overflow-hidden grain">
      <div className="aurora" />
      <div className="relative mx-auto grid max-w-6xl gap-8 px-5 py-6 lg:grid-cols-[1fr_360px] lg:py-10">
        {/* main column */}
        <div className="min-w-0">
          <Header step={step} onJump={go} />

          <div className="mt-8 lg:mt-12">
            <AnimatePresence mode="wait" custom={dir}>
              <motion.div
                key={STEPS[step]!.id}
                custom={dir}
                initial={{ opacity: 0, x: dir * 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: dir * -28 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                <p className="text-[0.8rem] font-medium uppercase tracking-[0.2em] text-tz-300">
                  Step {step + 1} of {STEPS.length}
                </p>
                <h1 className="mt-2 text-[2rem] leading-tight sm:text-[2.6rem]">
                  {STEPS[step]!.title}
                </h1>

                <div className="mt-7">
                  {step === 0 && <StepVision state={state} patch={patch} onParsed={() => go(1)} />}
                  {step === 1 && <StepCompany state={state} patch={patch} />}
                  {step === 2 && <StepPeople state={state} patch={patch} />}
                  {step === 3 && <StepReview state={state} />}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* footer nav */}
          <div className="mt-10 flex items-center justify-between border-t border-hairline pt-6">
            <Button
              variant="ghost"
              size="md"
              onClick={() => go(step - 1)}
              className={step === 0 ? "invisible" : ""}
            >
              <ArrowLeft className="size-4" /> Back
            </Button>

            {step < STEPS.length - 1 ? (
              <Button size="md" disabled={!canAdvance} onClick={() => go(step + 1)}>
                Continue <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button size="lg" disabled={!canAdvance || submitting} onClick={launch}>
                {submitting ? (
                  "Launching…"
                ) : (
                  <>
                    <Sparkles className="size-4" /> Launch registration
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* live preview */}
        <div className="hidden lg:block">
          <div className="sticky top-10">
            <BackgroundGradient className="bg-panel" containerClassName="rounded-[var(--radius-xl)]">
              <LivePreview state={state} step={step} />
            </BackgroundGradient>
          </div>
        </div>
      </div>
    </div>
  );
}

function Header({ step, onJump }: { step: number; onJump: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2.5">
        <div className="tz-gradient grid size-8 place-items-center rounded-lg text-white shadow-[var(--shadow-glow)]">
          <span className="font-display text-lg font-semibold">t</span>
        </div>
        <span className="font-display text-lg font-medium tracking-tight">tz-compliance</span>
      </div>

      <div className="flex items-center gap-1.5">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => i < step && onJump(i)}
            className="group flex items-center gap-1.5"
            disabled={i > step}
          >
            <span
              className={`grid size-6 place-items-center rounded-full text-[0.7rem] font-semibold transition-all duration-300 ${
                i < step
                  ? "tz-gradient text-white"
                  : i === step
                    ? "border border-tz-400/60 text-tz-300"
                    : "border border-hairline text-fg-faint"
              }`}
            >
              {i < step ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span
              className={`hidden text-[0.78rem] font-medium sm:inline ${
                i === step ? "text-fg" : "text-fg-faint"
              }`}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && <span className="mx-1 hidden h-px w-5 bg-hairline sm:inline-block" />}
          </button>
        ))}
      </div>
    </div>
  );
}

function validate(step: number, s: OnboardingState): boolean {
  switch (step) {
    case 0:
      return s.activities.length > 0 && s.activityDescription.length > 4;
    case 1:
      return (
        s.name.trim().length > 2 &&
        s.nameStatus !== "taken" &&
        s.activities.length > 0 &&
        s.region.length > 0 &&
        s.district.trim().length > 1 &&
        s.physicalAddress.trim().length > 4
      );
    case 2: {
      const directors = s.people.filter((p) => p.roles.includes("director"));
      const shareholders = s.people.filter((p) => p.roles.includes("shareholder"));
      const allocated = shareholders.reduce((sum, p) => sum + p.sharesHeld, 0);
      const hasContact = s.people.some((p) => p.email && p.phone);
      return (
        directors.length >= 1 &&
        directors.every((p) => (p.isForeign ? p.passportNo : p.identity) && p.tinVerified) &&
        shareholders.length >= 1 &&
        allocated === s.totalShares &&
        hasContact
      );
    }
    case 3:
      return true;
    default:
      return false;
  }
}
