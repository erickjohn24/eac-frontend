"use client";
import { motion } from "motion/react";
import { formatTzs } from "@tz/shared";
import type { OnboardingState } from "@/lib/onboarding-types";

/** The company taking shape — a live card that updates as the founder types. */
export function LivePreview({ state, step }: { state: OnboardingState; step: number }) {
  const initials = (state.name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const allocated = state.people
    .filter((p) => p.roles.includes("shareholder"))
    .reduce((s, p) => s + p.sharesHeld, 0);

  return (
    <div className="card overflow-hidden">
      <div className="relative h-24 tz-gradient">
        <div className="absolute inset-0 grain opacity-60" />
        <div className="absolute -bottom-6 left-5">
          <div className="grid size-14 place-items-center rounded-2xl border border-white/20 bg-bg-2 font-display text-xl text-fg shadow-lg">
            {initials}
          </div>
        </div>
      </div>

      <div className="px-5 pb-5 pt-9">
        <motion.h3 layout className="font-display text-lg leading-tight">
          {state.name || "Your company"}
        </motion.h3>
        <p className="text-[0.78rem] text-fg-faint">Private company limited by shares</p>

        {state.activities.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {state.activities.slice(0, 3).map((a) => (
              <span key={a.code} className="rounded-full bg-tz-500/12 px-2 py-0.5 text-[0.7rem] text-tz-300">
                {a.label.split(" ").slice(0, 2).join(" ")}
              </span>
            ))}
          </div>
        )}

        <dl className="mt-4 space-y-2.5 text-[0.8rem]">
          <PreviewRow label="Capital" value={state.shareCapitalTzs ? formatTzs(state.shareCapitalTzs) : "—"} filled={step >= 1} />
          <PreviewRow label="Location" value={state.district ? `${state.district}, ${state.region}` : state.region} filled={Boolean(state.district)} />
          <PreviewRow
            label="People"
            value={state.people.length ? `${state.people.length} added` : "—"}
            filled={state.people.length > 0}
          />
          {state.people.some((p) => p.roles.includes("shareholder")) && (
            <PreviewRow
              label="Shares"
              value={`${allocated}/${state.totalShares}`}
              filled={allocated === state.totalShares}
            />
          )}
        </dl>

        {state.people.length > 0 && (
          <div className="mt-4 flex -space-x-2">
            {state.people.slice(0, 5).map((p) => (
              <div
                key={p.id}
                title={p.fullName}
                className="grid size-8 place-items-center rounded-full border-2 border-panel bg-elevated text-[0.7rem] font-semibold text-fg-muted"
              >
                {(p.fullName || "?").slice(0, 1).toUpperCase()}
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 kanga-rule" />
        <p className="mt-3 text-center text-[0.72rem] text-fg-faint">
          Powered by agentic AI · driven on the real portals
        </p>
      </div>
    </div>
  );
}

function PreviewRow({ label, value, filled }: { label: string; value: string; filled: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-fg-faint">{label}</dt>
      <dd className={filled ? "font-medium text-fg" : "text-fg-faint"}>{value}</dd>
    </div>
  );
}
