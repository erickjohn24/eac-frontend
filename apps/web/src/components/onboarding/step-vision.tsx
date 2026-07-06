"use client";
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Loader2, PencilLine, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { AnimatedCheck } from "@/components/ui/animated-check";
import { TextGenerateEffect } from "@/components/ui/aceternity/text-generate-effect";
import type { OnboardingState } from "@/lib/onboarding-types";

const EXAMPLES = [
  "A software studio building apps for local businesses",
  "An online fashion & accessories shop",
  "A safari company for the northern circuit",
  "A restaurant and catering business in Arusha",
];

const SEQUENCE = [
  "Reading your description",
  "Matching registered activities",
  "Checking name availability at BRELA",
] as const;

type Phase = "idle" | "thinking" | "revealed";

export function StepVision({
  state,
  patch,
  onParsed,
}: {
  state: OnboardingState;
  patch: (p: Partial<OnboardingState>) => void;
  onParsed: () => void;
}) {
  const [phase, setPhase] = useState<Phase>(state.summary ? "revealed" : "idle");
  const [seqIndex, setSeqIndex] = useState(-1);
  const pending = useRef<Record<string, unknown> | null>(null);

  async function understand() {
    if (state.pitch.trim().length < 4) return;
    setPhase("thinking");
    setSeqIndex(0);
    pending.current = null;

    // fire the real request while the sequence plays
    const request = fetch("/api/ai/parse-business", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: state.pitch }),
    })
      .then((r) => r.json())
      .catch(() => null);

    // staged beats: each line gets its moment
    for (let i = 0; i < SEQUENCE.length; i++) {
      setSeqIndex(i);
      await new Promise((r) => setTimeout(r, i === 0 ? 750 : 850));
    }
    const data = await request;
    setSeqIndex(SEQUENCE.length);
    await new Promise((r) => setTimeout(r, 350));

    if (data && !data.error) {
      patch({
        summary: data.summary,
        aiSource: data.source,
        activities: data.activities,
        suggestedNames: data.suggestedNames,
        activityDescription: data.activityDescription,
        vatLikely: data.vatLikely,
        employeesLikely: data.employeesLikely,
        expectedAnnualTurnoverTzs: data.vatLikely ? 250_000_000 : 40_000_000,
        employeeCount: data.employeesLikely ? 3 : 0,
        name: state.name || data.suggestedNames?.[0] || "",
      });
      setPhase("revealed");
    } else {
      setPhase("idle");
      setSeqIndex(-1);
    }
  }

  function adjust() {
    setPhase("idle");
    setSeqIndex(-1);
  }

  return (
    <div>
      <p className="max-w-xl text-[1rem] leading-relaxed text-fg-muted">
        Tell us in plain language. Our AI turns it into your registered activities, the
        company objects, and a shortlist of available names — so you never fill a form
        you don't have to.
      </p>

      {phase !== "revealed" && (
        <>
          <div className="mt-6">
            <Textarea
              autoFocus
              rows={4}
              value={state.pitch}
              disabled={phase === "thinking"}
              onChange={(e) => patch({ pitch: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) understand();
              }}
              placeholder="e.g. A software studio building mobile apps for local businesses…"
              className="text-[1.05rem]"
            />
          </div>

          {phase === "idle" && (
            <div className="mt-4 flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => patch({ pitch: ex })}
                  className="rounded-full border border-hairline bg-panel-2 px-3.5 py-1.5 text-[0.8rem] font-medium text-fg-muted transition-all duration-200 hover:border-tz-400/40 hover:text-fg active:scale-95"
                >
                  {ex}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* single CTA */}
      {phase === "idle" && (
        <div className="mt-7">
          <Button size="lg" onClick={understand} disabled={state.pitch.trim().length < 4}>
            <Sparkles className="size-4" /> Understand my business
          </Button>
          <p className="text-caption mt-2.5">⌘↵ works too</p>
        </div>
      )}

      {/* staged sequence */}
      <AnimatePresence>
        {phase === "thinking" && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="card mt-7 p-5"
          >
            <ol className="space-y-3.5">
              {SEQUENCE.map((line, i) => {
                const done = seqIndex > i;
                const active = seqIndex === i;
                return (
                  <motion.li
                    key={line}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: seqIndex >= i ? 1 : 0.35, x: 0 }}
                    transition={{ delay: 0.05 }}
                    className="flex items-center gap-3"
                  >
                    <span className="grid size-6 place-items-center">
                      {done ? (
                        <span className="grid size-5 place-items-center rounded-full bg-success/15 text-success">
                          <AnimatedCheck size={12} />
                        </span>
                      ) : active ? (
                        <Loader2 className="size-4 animate-spin text-tz-300" />
                      ) : (
                        <span className="size-1.5 rounded-full bg-hairline-2" />
                      )}
                    </span>
                    <span
                      className={`text-[0.92rem] ${
                        done ? "text-fg-muted" : active ? "font-medium text-fg" : "text-fg-faint"
                      }`}
                    >
                      {line}
                      {active && <Ellipsis />}
                    </span>
                  </motion.li>
                );
              })}
            </ol>
          </motion.div>
        )}
      </AnimatePresence>

      {/* the understanding, revealed */}
      {phase === "revealed" && state.summary && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="mt-7"
        >
          <div className="card overflow-hidden">
            <div className="h-1 tz-gradient" />
            <div className="p-6">
              <p className="text-eyebrow flex items-center gap-1.5">
                <Sparkles className="size-3.5" /> What we understood
              </p>
              <TextGenerateEffect
                words={state.summary}
                className="text-title mt-3"
                duration={0.4}
              />
              <blockquote className="mt-3 border-l-2 border-hairline pl-3 text-[0.85rem] italic text-fg-faint">
                “{state.pitch}”
              </blockquote>

              <div className="mt-4">
                <p className="text-label mb-2">Registered activities</p>
                <div className="flex flex-wrap gap-2">
                  {state.activities.map((a, i) => (
                    <motion.span
                      key={a.code}
                      initial={{ opacity: 0, scale: 0.9, y: 6 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ delay: 0.35 + i * 0.09 }}
                      className="rounded-full border border-tz-400/30 bg-tz-500/10 px-3 py-1.5 text-[0.82rem] text-fg"
                    >
                      {a.label}
                    </motion.span>
                  ))}
                </div>
              </div>

              {state.suggestedNames.length > 0 && (
                <div className="mt-4">
                  <p className="text-label mb-2">Name ideas — checked against the register</p>
                  <div className="flex flex-wrap gap-2">
                    {state.suggestedNames.map((n, i) => (
                      <motion.span
                        key={n}
                        initial={{ opacity: 0, scale: 0.9, y: 6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ delay: 0.6 + i * 0.09 }}
                        className={`rounded-full border px-3 py-1.5 text-[0.82rem] ${
                          state.name === n
                            ? "border-tz-400/60 bg-tz-500/15 text-fg"
                            : "border-hairline bg-panel-2 text-fg-muted"
                        }`}
                      >
                        {n}
                      </motion.span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button size="lg" onClick={onParsed}>
              Looks right — continue <ArrowRight className="size-4" />
            </Button>
            <Button variant="ghost" size="lg" onClick={adjust}>
              <PencilLine className="size-4" /> Adjust description
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function Ellipsis() {
  return (
    <span className="inline-flex w-5">
      <motion.span
        animate={{ opacity: [0.2, 1, 0.2] }}
        transition={{ repeat: Infinity, duration: 1.2 }}
      >
        …
      </motion.span>
    </span>
  );
}
