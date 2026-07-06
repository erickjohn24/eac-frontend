"use client";
import { useState } from "react";
import { motion } from "motion/react";
import { Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { Chip } from "@/components/ui/chip";
import type { OnboardingState } from "@/lib/onboarding-types";

const EXAMPLES = [
  "A software studio building mobile apps for local businesses in Dar es Salaam",
  "An online shop selling fashion and accessories across Tanzania",
  "A tour and safari company running trips to the northern circuit",
  "A restaurant and catering business in Arusha",
];

export function StepVision({
  state,
  patch,
  onParsed,
}: {
  state: OnboardingState;
  patch: (p: Partial<OnboardingState>) => void;
  onParsed: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function understand() {
    if (state.pitch.trim().length < 4) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ai/parse-business", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: state.pitch }),
      });
      const data = await res.json();
      if (!data.error) {
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
        setTimeout(onParsed, 650);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <p className="max-w-xl text-[1.02rem] leading-relaxed text-fg-muted">
        Tell us in plain language. Our AI turns it into your registered activities,
        company objects and a shortlist of available names — so you never fill a form
        you don't have to.
      </p>

      <div className="mt-6">
        <Textarea
          autoFocus
          rows={4}
          value={state.pitch}
          onChange={(e) => patch({ pitch: e.target.value })}
          placeholder="e.g. A software studio building mobile apps for local businesses…"
          className="text-[1.05rem]"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <Chip key={ex} onClick={() => patch({ pitch: ex })}>
            {ex.length > 46 ? ex.slice(0, 44) + "…" : ex}
          </Chip>
        ))}
      </div>

      <div className="mt-7">
        <Button size="lg" onClick={understand} disabled={state.pitch.trim().length < 4 || loading}>
          {loading ? (
            <>
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }}
                className="inline-flex"
              >
                <Wand2 className="size-4" />
              </motion.span>
              Understanding…
            </>
          ) : (
            <>
              <Sparkles className="size-4" /> Understand my business
            </>
          )}
        </Button>
      </div>

      {state.summary && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="card mt-8 p-5"
        >
          <div className="flex items-center gap-2 text-[0.78rem] font-medium text-tz-300">
            <Sparkles className="size-3.5" />
            {state.aiSource === "ai" ? "AI understood" : "Here's what we picked up"}
          </div>
          <p className="mt-2 font-display text-lg">{state.summary}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {state.activities.map((a) => (
              <span
                key={a.code}
                className="rounded-full border border-tz-400/30 bg-tz-500/10 px-3 py-1 text-[0.8rem] text-fg"
              >
                {a.label}
              </span>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
