"use client";
import { motion } from "motion/react";
import {
  Building2,
  CalendarClock,
  HandCoins,
  Landmark,
  MapPin,
  PencilLine,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { PIPELINE_STEPS, formatTzs, getStep } from "@tz/shared";
import type { OnboardingState } from "@/lib/onboarding-types";

/**
 * Review as a filing receipt: every section links back to its step, fees are
 * itemized like a receipt, and "what happens next" is an honest per-stage
 * timeline with real ETA ranges from the pipeline definition.
 */

const FEES = [
  { label: "Name reservation", authority: "BRELA", amount: 50_000 },
  { label: "Company incorporation", authority: "BRELA", amount: 250_000 },
  { label: "Business licence", authority: "MIT / LGA", amount: 150_000 },
] as const;

const TIMELINE_IDS = [
  "brela.name_reservation",
  "brela.incorporation",
  "tra.company_tin",
  "licence.application",
  "bank.account",
  "stamp.order",
] as const;

export function StepReview({
  state,
  onEdit,
}: {
  state: OnboardingState;
  onEdit: (step: number) => void;
}) {
  const directors = state.people.filter((p) => p.roles.includes("director"));
  const totalFees = FEES.reduce((s, f) => s + f.amount, 0);
  const personalActions = 4; // payments · code · biometrics · bank signature

  return (
    <div className="space-y-6">
      <p className="max-w-xl text-[1rem] leading-relaxed text-fg-muted">
        Check the details below — then launch, and our agents start filing at BRELA
        immediately. You'll only hear from us when something needs you personally.
      </p>

      {/* hero stat strip — the decision info, first */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-3 overflow-hidden rounded-[var(--radius-lg)] border border-tz-400/25"
      >
        <HeroStat label="Government fees" value={`~${formatTzs(totalFees)}`} icon={Wallet} />
        <HeroStat label="Time to operational" value="2–3 weeks" icon={CalendarClock} divide />
        <HeroStat label="Things only you can do" value={String(personalActions)} icon={HandCoins} divide />
      </motion.div>

      {/* the receipt */}
      <div className="card overflow-hidden">
        <div className="h-1 tz-gradient" />
        <div className="flex items-start justify-between gap-4 p-6 pb-0">
          <div>
            <p className="text-eyebrow">Filing summary</p>
            <h2 className="text-title mt-2">{state.name || "Your company"}</h2>
            <p className="text-caption mt-0.5">Private company limited by shares · Tanzania mainland</p>
          </div>
        </div>

        <div className="space-y-0 p-6">
          <ReceiptSection
            icon={Building2}
            title="Business"
            onEdit={() => onEdit(1)}
            rows={[
              ["Activities", state.activities.map((a) => a.label).join(" · ")],
              ["Objects", state.activityDescription],
            ]}
          />
          <ReceiptSection
            icon={MapPin}
            title="Registered office"
            onEdit={() => onEdit(1)}
            rows={[["Address", `${state.physicalAddress}, ${state.district}, ${state.region}`]]}
          />
          <ReceiptSection
            icon={Wallet}
            title="Structure"
            onEdit={() => onEdit(1)}
            rows={[
              ["Share capital", `${formatTzs(state.shareCapitalTzs)} · ${state.totalShares.toLocaleString("en-US")} shares`],
              ["Financial year", `Ends ${["January","February","March","April","May","June","July","August","September","October","November","December"][state.fyEndMonth - 1]}`],
            ]}
          />
          <ReceiptSection
            icon={Users}
            title="People"
            onEdit={() => onEdit(2)}
            last
            rows={state.people.map((p) => [
              p.fullName || "Unnamed",
              [
                p.roles.map((r) => r.replace("signatory", "bank signatory")).join(", "),
                p.roles.includes("shareholder")
                  ? `${((p.sharesHeld / (state.totalShares || 1)) * 100).toFixed(0)}%`
                  : null,
                p.tinVerified ? "TIN ✓" : null,
                p.identity ? "NIDA ✓" : p.isForeign ? "passport" : null,
              ]
                .filter(Boolean)
                .join(" · "),
            ])}
          />
        </div>

        {/* fees, itemized */}
        <div className="border-t border-hairline bg-bg-2/40 p-6">
          <p className="text-label mb-3">Government fees (paid as you go, from your phone)</p>
          <table className="w-full text-[0.875rem]">
            <tbody>
              {FEES.map((f) => (
                <tr key={f.label}>
                  <td className="py-1 text-fg-muted">{f.label}</td>
                  <td className="py-1 text-right text-fg-faint">{f.authority}</td>
                  <td className="tnum w-28 py-1 text-right text-fg">{formatTzs(f.amount)}</td>
                </tr>
              ))}
              <tr className="border-t border-hairline">
                <td className="pt-2 font-semibold text-fg">Total</td>
                <td />
                <td className="tnum pt-2 text-right font-semibold text-fg">~{formatTzs(totalFees)}</td>
              </tr>
            </tbody>
          </table>
          <p className="text-caption mt-2">
            Our service fee is billed separately. TIN, NSSF, WCF and OSHA registrations are free.
          </p>
        </div>
      </div>

      {/* what happens next — honest timeline */}
      <div className="card p-6">
        <p className="text-section text-fg">What happens after you launch</p>
        <p className="text-caption mt-0.5">
          Real processing ranges from the government's own timelines. Steps run in parallel
          where the law allows.
        </p>
        <ol className="mt-5">
          {TIMELINE_IDS.map((id, i) => {
            const step = getStep(id);
            const [min, max] = step.etaDays;
            return (
              <li key={id} className="relative flex gap-4 pb-5 last:pb-0">
                {i < TIMELINE_IDS.length - 1 && (
                  <span className="absolute left-[13px] top-8 h-[calc(100%-1.75rem)] w-px bg-hairline" />
                )}
                <span className="tnum grid size-7 shrink-0 place-items-center rounded-full border border-hairline bg-bg-2 text-[0.72rem] font-bold text-fg-muted">
                  {i + 1}
                </span>
                <div className="flex min-w-0 flex-1 items-baseline justify-between gap-3 pt-0.5">
                  <div className="min-w-0">
                    <p className="text-[0.9rem] font-medium text-fg">{step.title}</p>
                    <p className="text-caption mt-0.5">{needsYou(id)}</p>
                  </div>
                  <span className="tnum shrink-0 rounded-full border border-hairline bg-panel-2 px-2.5 py-1 text-[0.72rem] font-medium text-fg-muted">
                    {min === max ? `${max}d` : `${min}–${max} days`}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* trust line */}
      <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-hairline bg-panel/60 p-4">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-tz-300" />
        <p className="text-[0.82rem] leading-relaxed text-fg-muted">
          Every document is prepared the way BRELA expects it — Memarts, Declaration of
          Compliance, first board resolution and your beneficial-ownership filing — and
          stored in your vault, investor-ready from day one.
        </p>
      </div>
    </div>
  );
}

function needsYou(stepId: string): string {
  switch (stepId) {
    case "brela.name_reservation":
      return "You approve one payment from your phone";
    case "brela.incorporation":
      return "You approve one payment · we file everything else";
    case "tra.company_tin":
      return "One director visits TRA once for biometrics";
    case "licence.application":
      return "You upload your lease · you approve one payment";
    case "bank.account":
      return "Signatories sign at the branch · we prepare the full pack";
    case "stamp.order":
      return "Nothing — delivered to your door";
    default:
      return "";
  }
}

function HeroStat({
  label,
  value,
  icon: Icon,
  divide,
}: {
  label: string;
  value: string;
  icon: typeof Wallet;
  divide?: boolean;
}) {
  return (
    <div className={`bg-tz-500/[0.06] p-4 sm:p-5 ${divide ? "border-l border-tz-400/20" : ""}`}>
      <Icon className="size-4 text-tz-300" />
      <p className="tnum mt-2 font-display text-[1.25rem] leading-tight text-fg sm:text-[1.45rem]">{value}</p>
      <p className="text-caption mt-0.5">{label}</p>
    </div>
  );
}

function ReceiptSection({
  icon: Icon,
  title,
  rows,
  onEdit,
  last,
}: {
  icon: typeof Landmark;
  title: string;
  rows: [string, string][];
  onEdit: () => void;
  last?: boolean;
}) {
  return (
    <div className={`py-4 first:pt-0 ${last ? "" : "border-b border-hairline"}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-[0.8rem] font-semibold uppercase tracking-wider text-fg-faint">
          <Icon className="size-3.5" /> {title}
        </p>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1 text-[0.78rem] font-medium text-tz-300 transition-colors hover:text-tz-400"
        >
          <PencilLine className="size-3" /> Edit
        </button>
      </div>
      <dl className="mt-2.5 space-y-1.5">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[7.5rem_1fr] gap-3 text-[0.875rem]">
            <dt className="text-fg-faint">{k}</dt>
            <dd className="min-w-0 text-fg">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
