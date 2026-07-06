"use client";
import { motion } from "motion/react";
import { Wand2 } from "lucide-react";
import { formatTzs } from "@tz/shared";
import type { OnboardingState } from "@/lib/onboarding-types";
import { PERSON_COLORS } from "./context-panel";

/**
 * The cap table: a live, visual reading of ownership. Lives WITH the people
 * (not at page bottom), shows per-person %, and can auto-balance.
 */
export function CapTable({
  state,
  onAutoSplit,
}: {
  state: OnboardingState;
  onAutoSplit: () => void;
}) {
  const holders = state.people
    .map((p, i) => ({ ...p, color: PERSON_COLORS[i % PERSON_COLORS.length]! }))
    .filter((p) => p.roles.includes("shareholder"));
  if (holders.length === 0) return null;

  const allocated = holders.reduce((s, p) => s + p.sharesHeld, 0);
  const total = state.totalShares || 1;
  const balanced = allocated === state.totalShares;
  const parValue = Math.round(state.shareCapitalTzs / total);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-section text-fg">Ownership</p>
          <p className="text-caption tnum mt-0.5">
            {state.totalShares.toLocaleString("en-US")} shares · par value {formatTzs(parValue)}
          </p>
        </div>
        <button
          type="button"
          onClick={onAutoSplit}
          className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-3 py-1.5 text-[0.78rem] font-medium text-tz-300 transition-colors hover:border-tz-400/40"
        >
          <Wand2 className="size-3.5" /> Split evenly
        </button>
      </div>

      {/* stacked allocation bar */}
      <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-bg-2">
        {holders.map((p) => (
          <motion.div
            key={p.id}
            layout
            className="h-full border-r border-bg last:border-r-0"
            animate={{ width: `${Math.min(100, (p.sharesHeld / total) * 100)}%` }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            style={{ background: p.color }}
            title={`${p.fullName}: ${p.sharesHeld} shares`}
          />
        ))}
        {allocated < state.totalShares && (
          <div
            className="h-full"
            style={{
              width: `${((state.totalShares - allocated) / total) * 100}%`,
              background:
                "repeating-linear-gradient(45deg, transparent 0 4px, rgba(236,236,245,0.07) 4px 8px)",
            }}
          />
        )}
      </div>

      {/* legend with per-person % and value */}
      <ul className="mt-4 space-y-2">
        {holders.map((p) => {
          const pct = (p.sharesHeld / total) * 100;
          return (
            <li key={p.id} className="flex items-center justify-between gap-3 text-[0.85rem]">
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
                <span className="truncate text-fg">{p.fullName || "Unnamed"}</span>
              </span>
              <span className="tnum shrink-0 text-fg-muted">
                {p.sharesHeld.toLocaleString("en-US")} · {pct.toFixed(pct % 1 === 0 ? 0 : 1)}%
                <span className="ml-2 hidden text-fg-faint sm:inline">
                  {formatTzs(p.sharesHeld * parValue)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      <p className={`tnum mt-3 text-[0.8rem] ${balanced ? "text-success" : "text-warning"}`}>
        {balanced
          ? "Fully allocated ✓"
          : allocated > state.totalShares
            ? `${(allocated - state.totalShares).toLocaleString("en-US")} over — reduce someone's holding`
            : `${(state.totalShares - allocated).toLocaleString("en-US")} share${state.totalShares - allocated === 1 ? "" : "s"} left to allocate`}
      </p>
    </div>
  );
}
