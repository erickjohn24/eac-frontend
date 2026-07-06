"use client";
import { AnimatePresence, motion } from "motion/react";
import {
  Banknote,
  Building2,
  CalendarClock,
  Check,
  FileSignature,
  HandCoins,
  MapPin,
  Sparkles,
  Users,
  Wand2,
} from "lucide-react";
import { formatTzs } from "@tz/shared";
import type { OnboardingState } from "@/lib/onboarding-types";
import { CountUp } from "@/components/ui/animated-check";

/**
 * The right-rail context panel. Unlike a "preview card", it is useful from the
 * first keystroke: step 1 explains how the process works; steps 2–3 show the
 * company taking shape (only facts the founder actually entered); step 4 is
 * covered by the receipt in the main column, so the panel shows the totals.
 */
export function ContextPanel({ state, step }: { state: OnboardingState; step: number }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={step === 0 ? "how" : "company"}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        {step === 0 ? <HowItWorks /> : <CompanyCard state={state} step={step} />}
      </motion.div>
    </AnimatePresence>
  );
}

function HowItWorks() {
  const beats = [
    {
      icon: Wand2,
      title: "Tell us your vision",
      body: "Plain language in — activities, objects and name ideas out.",
    },
    {
      icon: FileSignature,
      title: "We file everything",
      body: "Our agents drive BRELA, TRA and the licence portals for you.",
    },
    {
      icon: HandCoins,
      title: "You approve 4 things",
      body: "Payments, one security code, one biometrics visit, one bank signature.",
    },
  ];
  return (
    <div className="card overflow-hidden">
      <div className="h-1 tz-gradient" />
      <div className="p-5">
        <p className="text-eyebrow">How it works</p>
        <ol className="mt-4 space-y-0">
          {beats.map((b, i) => (
            <li key={b.title} className="relative flex gap-3.5 pb-5 last:pb-0">
              {i < beats.length - 1 && (
                <span className="absolute left-[15px] top-9 h-[calc(100%-2.25rem)] w-px bg-hairline" />
              )}
              <span className="grid size-8 shrink-0 place-items-center rounded-full border border-hairline bg-bg-2">
                <b.icon className="size-3.5 text-tz-300" />
              </span>
              <span className="pt-0.5">
                <span className="block text-[0.875rem] font-semibold text-fg">{b.title}</span>
                <span className="mt-0.5 block text-[0.8rem] leading-relaxed text-fg-muted">
                  {b.body}
                </span>
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-5 space-y-2.5 border-t border-hairline pt-4">
          <Stat icon={Banknote} label="Government fees" value="~TSh 450,000" />
          <Stat icon={CalendarClock} label="Time to operational" value="2–3 weeks" />
          <Stat icon={Sparkles} label="Forms you fill" value="This one" accent />
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Banknote;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-[0.8rem] text-fg-muted">
        <Icon className="size-3.5 text-fg-faint" /> {label}
      </span>
      <span className={`tnum text-[0.82rem] font-semibold ${accent ? "tz-gradient-text" : "text-fg"}`}>
        {value}
      </span>
    </div>
  );
}

const PERSON_COLORS = ["#7c6bf5", "#22d3ee", "#e4b458", "#34d399", "#fb7185", "#9a8bff"];

function CompanyCard({ state, step }: { state: OnboardingState; step: number }) {
  const shareholders = state.people.filter((p) => p.roles.includes("shareholder"));
  const allocated = shareholders.reduce((s, p) => s + p.sharesHeld, 0);
  const directors = state.people.filter((p) => p.roles.includes("director"));

  return (
    <div className="card overflow-hidden">
      <div className="h-1 tz-gradient" />
      <div className="p-5">
        <p className="text-eyebrow">Your company</p>
        <motion.h3 layout className="text-title mt-2.5 leading-snug">
          {state.name || <span className="text-fg-faint">Untitled company</span>}
        </motion.h3>
        <p className="mt-0.5 text-caption">Private company limited by shares</p>

        {state.activities.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {state.activities.slice(0, 3).map((a, i) => (
              <motion.span
                key={a.code}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-full bg-tz-500/12 px-2.5 py-1 text-[0.72rem] font-medium text-tz-300"
              >
                {a.label.length > 26 ? a.label.slice(0, 24) + "…" : a.label}
              </motion.span>
            ))}
          </div>
        )}

        <dl className="mt-4 space-y-2.5">
          <FactRow
            icon={MapPin}
            label="Registered office"
            value={state.district ? `${state.district}, ${state.region}` : null}
          />
          <FactRow
            icon={Banknote}
            label="Share capital"
            value={
              state.shareCapitalTzs ? (
                <CountUp value={state.shareCapitalTzs} format={(n) => formatTzs(n)} />
              ) : null
            }
          />
          <FactRow
            icon={Users}
            label="People"
            value={
              state.people.length > 0
                ? `${directors.length} director${directors.length === 1 ? "" : "s"} · ${state.people.length} total`
                : null
            }
          />
        </dl>

        {/* ownership strip appears once shares are being allocated */}
        {step >= 2 && shareholders.length > 0 && (
          <div className="mt-4 border-t border-hairline pt-4">
            <div className="flex items-center justify-between">
              <span className="text-caption">Ownership</span>
              <span
                className={`tnum text-[0.75rem] font-semibold ${
                  allocated === state.totalShares ? "text-success" : "text-warning"
                }`}
              >
                {allocated}/{state.totalShares}
              </span>
            </div>
            <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-bg-2">
              {shareholders.map((p, i) => (
                <motion.span
                  key={p.id}
                  layout
                  className="h-full"
                  animate={{
                    width: `${Math.min(100, (p.sharesHeld / (state.totalShares || 1)) * 100)}%`,
                  }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  style={{ background: PERSON_COLORS[i % PERSON_COLORS.length] }}
                />
              ))}
            </div>
          </div>
        )}

        {state.people.length > 0 && (
          <div className="mt-4 flex -space-x-2">
            {state.people.slice(0, 5).map((p, i) => (
              <span
                key={p.id}
                title={p.fullName}
                className="grid size-8 place-items-center rounded-full border-2 border-panel text-[0.7rem] font-bold text-bg"
                style={{ background: PERSON_COLORS[i % PERSON_COLORS.length] }}
              >
                {(p.fullName || "?").slice(0, 1).toUpperCase()}
              </span>
            ))}
          </div>
        )}

        <div className="mt-5 flex items-center gap-2 border-t border-hairline pt-4">
          <Building2 className="size-3.5 shrink-0 text-fg-faint" />
          <p className="text-[0.72rem] leading-relaxed text-fg-faint">
            Filed on the real BRELA & TRA portals by our AI agents.
          </p>
        </div>
      </div>
    </div>
  );
}

function FactRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: React.ReactNode | null;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-2 text-[0.8rem] text-fg-muted">
        <Icon className="size-3.5 text-fg-faint" /> {label}
      </dt>
      <dd className="text-right text-[0.82rem] font-medium text-fg">
        {value ?? <span className="font-normal text-fg-faint">—</span>}
      </dd>
    </div>
  );
}

export { PERSON_COLORS };
export function ChecklistIcon() {
  return <Check className="size-3.5" />;
}
