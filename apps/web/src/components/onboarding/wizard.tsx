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
import { ContextPanel } from "./context-panel";

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

  const gate = useMemo(() => validate(step, state), [step, state]);
  const substeps = useMemo(() => substepStatus(step, state), [step, state]);

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
      router.push(`/dashboard/${id}?launched=1`);
    } catch {
      setSubmitting(false);
    }
  }

  // Step 0 drives itself entirely via its own CTAs (single-CTA rule).
  const showFooterNav = step > 0;

  return (
    <div className="relative min-h-dvh">
      <div className="backdrop" />

      {/* mobile compact header */}
      <header className="sticky top-0 z-30 border-b border-hairline bg-bg/85 backdrop-blur-lg lg:hidden">
        <div className="flex items-center justify-between px-5 py-3">
          <Wordmark />
          <span className="text-caption tnum">
            Step {step + 1} of {STEPS.length} · <span className="text-fg-muted">{STEPS[step]!.label}</span>
          </span>
        </div>
        <div className="h-0.5 bg-bg-2">
          <motion.div
            className="h-full tz-gradient"
            animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </header>

      <div className="relative z-10 mx-auto grid max-w-[1180px] gap-10 px-5 pb-32 lg:grid-cols-[190px_minmax(0,640px)_300px] lg:justify-center lg:gap-12 lg:pb-16">
        {/* progress rail */}
        <aside className="hidden lg:block">
          <div className="sticky top-0 flex h-dvh flex-col py-10">
            <Wordmark />
            <nav className="mt-12 flex-1">
              <ol className="relative space-y-1">
                {STEPS.map((s, i) => {
                  const done = i < step;
                  const active = i === step;
                  return (
                    <li key={s.id} className="relative">
                      {i < STEPS.length - 1 && (
                        <span
                          className={`absolute left-[13px] top-8 h-[calc(100%-1rem)] w-px transition-colors duration-500 ${
                            done ? "bg-tz-400/60" : "bg-hairline"
                          }`}
                        />
                      )}
                      <button
                        onClick={() => done && go(i)}
                        disabled={!done}
                        className={`group flex w-full items-center gap-3 rounded-[var(--radius)] px-0.5 py-2 text-left ${done ? "cursor-pointer" : "cursor-default"}`}
                      >
                        <span
                          className={`grid size-[26px] shrink-0 place-items-center rounded-full text-[0.7rem] font-bold transition-all duration-300 ${
                            done
                              ? "tz-gradient text-white"
                              : active
                                ? "border-2 border-tz-400 text-tz-300"
                                : "border border-hairline text-fg-faint"
                          }`}
                        >
                          {done ? <Check className="size-3.5" /> : i + 1}
                        </span>
                        <span
                          className={`text-[0.875rem] font-medium transition-colors ${
                            active ? "text-fg" : done ? "text-fg-muted group-hover:text-fg" : "text-fg-faint"
                          }`}
                        >
                          {s.label}
                        </span>
                      </button>
                      {/* live substeps under the active step */}
                      {active && substeps.length > 0 && (
                        <motion.ul
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="mb-1 ml-[13px] space-y-1.5 overflow-hidden border-l border-hairline pb-1 pl-6 pt-1"
                        >
                          {substeps.map((sub) => (
                            <li key={sub.label} className="flex items-center gap-2">
                              <span
                                className={`size-1.5 rounded-full transition-colors ${
                                  sub.done ? "bg-success" : "bg-hairline-2"
                                }`}
                              />
                              <span className={`text-[0.75rem] ${sub.done ? "text-fg-muted" : "text-fg-faint"}`}>
                                {sub.label}
                              </span>
                            </li>
                          ))}
                        </motion.ul>
                      )}
                    </li>
                  );
                })}
              </ol>
            </nav>
            <p className="text-caption">
              Your progress saves automatically.
            </p>
          </div>
        </aside>

        {/* main column */}
        <main className="min-w-0 pt-8 lg:pt-14">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={STEPS[step]!.id}
              custom={dir}
              initial={{ opacity: 0, x: dir * 26 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -26 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="text-eyebrow">
                Step {step + 1} of {STEPS.length}
              </p>
              <h1 className="text-display mt-2.5">{STEPS[step]!.title}</h1>

              <div className="mt-7">
                {step === 0 && <StepVision state={state} patch={patch} onParsed={() => go(1)} />}
                {step === 1 && <StepCompany state={state} patch={patch} />}
                {step === 2 && <StepPeople state={state} patch={patch} />}
                {step === 3 && <StepReview state={state} onEdit={go} />}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* desktop footer nav */}
          {showFooterNav && (
            <div className="mt-10 hidden items-center justify-between border-t border-hairline pt-6 lg:flex">
              <Button
                variant="ghost"
                size="md"
                onClick={() => go(step - 1)}
                className={step === 0 ? "invisible" : ""}
              >
                <ArrowLeft className="size-4" /> Back
              </Button>
              <div className="flex items-center gap-4">
                {!gate.ok && gate.reason && (
                  <span className="text-caption max-w-64 text-right">{gate.reason}</span>
                )}
                {step < STEPS.length - 1 ? (
                  <Button size="md" disabled={!gate.ok} onClick={() => go(step + 1)}>
                    Continue <ArrowRight className="size-4" />
                  </Button>
                ) : (
                  <Button size="lg" disabled={!gate.ok || submitting} onClick={launch}>
                    {submitting ? "Launching…" : (
                      <>
                        <Sparkles className="size-4" /> Launch registration
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}
        </main>

        {/* context panel */}
        <aside className="hidden lg:block">
          <div className="sticky top-10 pt-14">
            <ContextPanel state={state} step={step} />
          </div>
        </aside>
      </div>

      {/* mobile sticky action bar */}
      {showFooterNav && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-bg/90 backdrop-blur-xl lg:hidden">
          {!gate.ok && gate.reason && (
            <p className="border-b border-hairline px-5 py-2 text-[0.75rem] text-warning">
              {gate.reason}
            </p>
          )}
          <div className="flex items-center gap-3 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {step > 0 && (
              <Button variant="outline" size="md" onClick={() => go(step - 1)} className="shrink-0">
                <ArrowLeft className="size-4" />
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button size="md" disabled={!gate.ok} onClick={() => go(step + 1)} className="flex-1">
                Continue <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button size="md" disabled={!gate.ok || submitting} onClick={launch} className="flex-1">
                {submitting ? "Launching…" : (
                  <>
                    <Sparkles className="size-4" /> Launch registration
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="tz-gradient grid size-8 place-items-center rounded-lg text-white shadow-[var(--shadow-glow)]">
        <span className="font-display text-lg font-semibold">t</span>
      </div>
      <span className="font-display text-lg font-medium tracking-tight">tz-compliance</span>
    </div>
  );
}

/** Per-step gating with a human-readable blocking reason. */
function validate(step: number, s: OnboardingState): { ok: boolean; reason?: string } {
  switch (step) {
    case 0:
      if (s.activities.length === 0 || s.activityDescription.length <= 4) {
        return { ok: false, reason: "Describe your business and let the AI read it first." };
      }
      return { ok: true };
    case 1: {
      if (s.name.trim().length <= 2) return { ok: false, reason: "Give your company a name." };
      if (s.nameStatus === "taken") return { ok: false, reason: "That name is taken — pick another." };
      if (s.activities.length === 0) return { ok: false, reason: "Add at least one business activity." };
      if (s.district.trim().length <= 1 || s.physicalAddress.trim().length <= 4) {
        return { ok: false, reason: "Add your registered office address." };
      }
      return { ok: true };
    }
    case 2: {
      const directors = s.people.filter((p) => p.roles.includes("director"));
      const shareholders = s.people.filter((p) => p.roles.includes("shareholder"));
      const allocated = shareholders.reduce((sum, p) => sum + p.sharesHeld, 0);
      if (directors.length === 0) return { ok: false, reason: "Add at least one director." };
      const unverified = directors.find(
        (p) => !((p.isForeign ? p.passportNo : p.identity) && p.tinVerified),
      );
      if (unverified) {
        return { ok: false, reason: `${unverified.fullName || "A director"} still needs a verified ID and TIN.` };
      }
      if (shareholders.length === 0) return { ok: false, reason: "At least one person must hold shares." };
      if (allocated !== s.totalShares) {
        const diff = s.totalShares - allocated;
        return {
          ok: false,
          reason: diff > 0 ? `${diff} share${diff === 1 ? "" : "s"} left to allocate.` : `${-diff} too many shares allocated.`,
        };
      }
      if (!s.people.some((p) => p.email && p.phone)) {
        return { ok: false, reason: "Add contact details for the primary contact." };
      }
      return { ok: true };
    }
    default:
      return { ok: true };
  }
}

/** Live substep indicators for the progress rail. */
function substepStatus(step: number, s: OnboardingState): { label: string; done: boolean }[] {
  switch (step) {
    case 0:
      return [
        { label: "Describe it", done: s.pitch.trim().length > 4 },
        { label: "AI understanding", done: Boolean(s.summary) },
      ];
    case 1:
      return [
        { label: "Name", done: s.name.trim().length > 2 && s.nameStatus !== "taken" },
        { label: "Activities", done: s.activities.length > 0 },
        { label: "Location", done: s.district.trim().length > 1 && s.physicalAddress.trim().length > 4 },
        { label: "Structure", done: s.shareCapitalTzs > 0 && s.totalShares > 0 },
      ];
    case 2: {
      const directors = s.people.filter((p) => p.roles.includes("director"));
      const shareholders = s.people.filter((p) => p.roles.includes("shareholder"));
      const allocated = shareholders.reduce((sum, p) => sum + p.sharesHeld, 0);
      return [
        {
          label: "Directors verified",
          done:
            directors.length > 0 &&
            directors.every((p) => (p.isForeign ? p.passportNo : p.identity) && p.tinVerified),
        },
        { label: "Shares allocated", done: shareholders.length > 0 && allocated === s.totalShares },
        { label: "Contact", done: s.people.some((p) => p.email && p.phone) },
      ];
    }
    case 3:
      return [{ label: "Review", done: false }, { label: "Launch", done: false }];
    default:
      return [];
  }
}
