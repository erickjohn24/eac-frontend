"use client";
import { Building2, CalendarClock, Landmark, ShieldCheck, Stamp, Wallet } from "lucide-react";
import { formatTzs } from "@tz/shared";
import type { OnboardingState } from "@/lib/onboarding-types";

export function StepReview({ state }: { state: OnboardingState }) {
  const govFees = 50_000 + 250_000 + (state.vatLikely ? 0 : 0) + 150_000; // reservation + incorporation + licence
  const directors = state.people.filter((p) => p.roles.includes("director"));

  return (
    <div className="space-y-6">
      <p className="max-w-xl text-[1.02rem] leading-relaxed text-fg-muted">
        Here's your company. When you launch, our AI agents start working through the
        government portals immediately. You'll only be asked for the few things that
        legally require you.
      </p>

      {/* company card */}
      <div className="card overflow-hidden">
        <div className="tz-gradient px-6 py-5">
          <p className="text-[0.72rem] uppercase tracking-[0.2em] text-white/70">Private company limited by shares</p>
          <h2 className="mt-1 font-display text-2xl text-white">{state.name || "Your company"}</h2>
        </div>
        <div className="grid gap-5 p-6 sm:grid-cols-2">
          <Row icon={Building2} label="Activities" value={state.activities.map((a) => a.label).join(", ")} />
          <Row icon={Wallet} label="Share capital" value={`${formatTzs(state.shareCapitalTzs)} · ${state.totalShares} shares`} />
          <Row icon={Landmark} label="Registered office" value={`${state.physicalAddress}, ${state.district}, ${state.region}`} />
          <Row icon={ShieldCheck} label="People" value={`${directors.length} director${directors.length > 1 ? "s" : ""}, ${state.people.length} total`} />
        </div>
      </div>

      {/* what we handle */}
      <div className="card p-6">
        <h3 className="text-base font-medium">What we handle automatically</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            "Name reservation & incorporation at BRELA",
            "Company & director TIN with TRA",
            "Business licence application",
            state.employeeCount > 0 ? "NSSF, WCF & OSHA employer registrations" : "Employer registrations (when you hire)",
            "Bank account document pack & booking",
            "Company stamp ordered & delivered",
          ].map((t) => (
            <div key={t} className="flex items-center gap-2.5 text-[0.9rem] text-fg-muted">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-success/15 text-success">✓</span>
              {t}
            </div>
          ))}
        </div>
      </div>

      {/* what we need from you */}
      <div className="card p-6">
        <h3 className="text-base font-medium">The only things we'll need from you</h3>
        <p className="mt-1 text-[0.85rem] text-fg-faint">Because the government requires you, personally.</p>
        <div className="mt-4 space-y-3">
          <Need icon={Wallet} title="Approve government payments" body="Tap to pay each fee from your phone via M-Pesa, Mixx, Airtel Money or HaloPesa." />
          <Need icon={ShieldCheck} title="A quick security check & code" body="Solve one BRELA check and enter the TRA code we relay to you." />
          <Need icon={Building2} title="One TRA biometrics visit" body="A director captures fingerprints once so your TIN can be issued." />
          <Need icon={Landmark} title="Sign at the bank" body="Signatories attend one branch appointment — we prepare the whole pack." />
          <Need icon={Stamp} title="Nothing for your stamp" body="We order it from a Dar es Salaam vendor and track delivery to you." />
        </div>
      </div>

      {/* estimate */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-tz-400/30 bg-tz-500/[0.07] p-5">
        <div className="flex items-center gap-3">
          <CalendarClock className="size-5 text-tz-300" />
          <div>
            <p className="text-[0.85rem] font-medium">Typical time to fully operational</p>
            <p className="text-[0.8rem] text-fg-faint">Most steps run in parallel</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-display text-xl">2–3 weeks</p>
          <p className="text-[0.8rem] text-fg-faint">~{formatTzs(govFees)} government fees</p>
        </div>
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-tz-300" />
      <div className="min-w-0">
        <p className="text-[0.72rem] uppercase tracking-wide text-fg-faint">{label}</p>
        <p className="text-[0.9rem] text-fg">{value || "—"}</p>
      </div>
    </div>
  );
}

function Need({ icon: Icon, title, body }: { icon: typeof Building2; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[var(--radius)] border border-hairline bg-bg-2">
        <Icon className="size-4 text-tz-300" />
      </span>
      <div>
        <p className="text-[0.9rem] font-medium">{title}</p>
        <p className="text-[0.82rem] text-fg-faint">{body}</p>
      </div>
    </div>
  );
}
