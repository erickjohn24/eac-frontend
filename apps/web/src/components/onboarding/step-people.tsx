"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BadgeCheck, Check, Loader2, ShieldCheck, Trash2, UserPlus, X } from "lucide-react";
import { Field, Input } from "@/components/ui/field";
import { Chip } from "@/components/ui/chip";
import { InfoTip } from "@/components/ui/info-tip";
import { formatTin } from "@tz/shared";
import {
  newPerson,
  type OnboardingPerson,
  type OnboardingState,
  type Role,
} from "@/lib/onboarding-types";
import { CapTable } from "./cap-table";

const ROLES: { id: Role; label: string; explain: string }[] = [
  {
    id: "director",
    label: "Director",
    explain:
      "Runs the company and is legally responsible for it. This means BRELA needs their verified National ID and personal TIN before it will register the company — we check both here so nothing bounces later.",
  },
  {
    id: "shareholder",
    label: "Shareholder",
    explain:
      "Owns part of the company. Shareholders go on the register, and we prepare the beneficial-ownership filing for you — missing it freezes all BRELA transactions, so it's one of the things we never let slip.",
  },
  {
    id: "signatory",
    label: "Bank signatory",
    explain:
      "Can sign on the company bank account. Signatories attend one branch appointment — we prepare the full document pack so it's a single visit.",
  },
];

export function StepPeople({
  state,
  patch,
}: {
  state: OnboardingState;
  patch: (p: Partial<OnboardingState>) => void;
}) {
  function update(id: string, p: Partial<OnboardingPerson>) {
    patch({ people: state.people.map((x) => (x.id === id ? { ...x, ...p } : x)) });
  }
  function add() {
    const first = state.people.length === 0;
    patch({ people: [...state.people, { ...newPerson(), isPrimaryContact: first }] });
  }
  function remove(id: string) {
    patch({ people: state.people.filter((x) => x.id !== id) });
  }
  function autoSplit() {
    const holders = state.people.filter((p) => p.roles.includes("shareholder"));
    if (holders.length === 0) return;
    const base = Math.floor(state.totalShares / holders.length);
    let rem = state.totalShares - base * holders.length;
    patch({
      people: state.people.map((p) => {
        if (!p.roles.includes("shareholder")) return { ...p, sharesHeld: 0 };
        const extra = rem > 0 ? 1 : 0;
        rem -= extra;
        return { ...p, sharesHeld: base + extra };
      }),
    });
  }

  return (
    <div>
      <p className="max-w-xl text-[1rem] leading-relaxed text-fg-muted">
        Add each person once. Enter a National ID and we pull their verified details
        straight from NIDA — no retyping names or birth dates. One person can hold several
        roles.
      </p>

      <div className="mt-6 space-y-4">
        <AnimatePresence initial={false}>
          {state.people.map((person, i) => (
            <motion.div
              key={person.id}
              layout
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
            >
              <PersonCard
                person={person}
                index={i}
                totalShares={state.totalShares}
                onUpdate={(p) => update(person.id, p)}
                onRemove={() => remove(person.id)}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* the cap table lives with the people */}
        {state.people.some((p) => p.roles.includes("shareholder")) && (
          <CapTable state={state} onAutoSplit={autoSplit} />
        )}

        <button
          onClick={add}
          className="group flex w-full items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-dashed border-hairline py-5 text-fg-muted transition-colors hover:border-tz-400/50 hover:text-fg"
        >
          <UserPlus className="size-4" />
          {state.people.length === 0 ? "Add the first director" : "Add another person"}
        </button>
      </div>
    </div>
  );
}

function PersonCard({
  person,
  index,
  totalShares,
  onUpdate,
  onRemove,
}: {
  person: OnboardingPerson;
  index: number;
  totalShares: number;
  onUpdate: (p: Partial<OnboardingPerson>) => void;
  onRemove: () => void;
}) {
  const [ninLoading, setNinLoading] = useState(false);
  const [ninError, setNinError] = useState<string>();
  const [tinLoading, setTinLoading] = useState(false);

  async function lookupNin(value: string) {
    const clean = value.replace(/\D/g, "");
    onUpdate({ nin: clean });
    setNinError(undefined);
    if (clean.length !== 20) {
      onUpdate({ identity: undefined, fullName: "" });
      return;
    }
    setNinLoading(true);
    try {
      const res = await fetch("/api/nida", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nin: clean }),
      });
      const data = await res.json();
      if (data.identity) {
        onUpdate({
          identity: data.identity,
          fullName: data.identity.fullName,
          nationality: data.identity.nationality,
        });
      } else {
        setNinError(data.error);
        onUpdate({ identity: undefined, fullName: "" });
      }
    } finally {
      setNinLoading(false);
    }
  }

  async function verifyTin(value: string) {
    const clean = value.replace(/\D/g, "").slice(0, 9);
    onUpdate({ tin: formatTin(clean), tinVerified: false });
    if (clean.length !== 9) return;
    setTinLoading(true);
    try {
      const res = await fetch("/api/verify-tin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tin: clean, name: person.fullName }),
      });
      const data = await res.json();
      onUpdate({ tinVerified: data.valid, tinRegisteredName: data.registeredName });
    } finally {
      setTinLoading(false);
    }
  }

  function toggleRole(role: Role) {
    const has = person.roles.includes(role);
    onUpdate({ roles: has ? person.roles.filter((r) => r !== role) : [...person.roles, role] });
  }

  const isDirector = person.roles.includes("director");
  const isShareholder = person.roles.includes("shareholder");

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-full bg-tz-500/15 text-[0.75rem] font-semibold text-tz-300">
            {index + 1}
          </span>
          <span className="text-[0.85rem] font-medium text-fg-muted">
            {person.fullName || "New person"}
          </span>
          {person.identity && (
            <span className="inline-flex items-center gap-1 text-[0.72rem] text-success">
              <BadgeCheck className="size-3.5" /> NIDA verified
            </span>
          )}
        </div>
        <button onClick={onRemove} className="text-fg-faint hover:text-danger">
          <Trash2 className="size-4" />
        </button>
      </div>

      {/* nationality toggle */}
      <div className="mt-4 inline-flex rounded-full border border-hairline p-0.5 text-[0.8rem]">
        <button
          onClick={() => onUpdate({ isForeign: false })}
          className={`rounded-full px-3 py-1 transition ${!person.isForeign ? "tz-gradient text-white" : "text-fg-muted"}`}
        >
          Tanzanian
        </button>
        <button
          onClick={() => onUpdate({ isForeign: true, identity: undefined })}
          className={`rounded-full px-3 py-1 transition ${person.isForeign ? "tz-gradient text-white" : "text-fg-muted"}`}
        >
          Foreign national
        </button>
      </div>

      {/* identity */}
      {!person.isForeign ? (
        <div className="mt-4">
          <Field label="National ID (NIN)" error={ninError}>
            <div className="relative">
              <Input
                value={person.nin}
                inputMode="numeric"
                maxLength={20}
                onChange={(e) => lookupNin(e.target.value)}
                placeholder="20-digit National ID"
                className="pr-10 font-mono tracking-tight"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                {ninLoading ? (
                  <Loader2 className="size-4 animate-spin text-fg-faint" />
                ) : person.identity ? (
                  <Check className="size-4 text-success" />
                ) : null}
              </span>
            </div>
          </Field>

          <AnimatePresence>
            {person.identity && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 overflow-hidden"
              >
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-[var(--radius)] border border-success/20 bg-success/[0.06] p-3.5 text-[0.82rem]">
                  <Confirmed label="Legal name" value={person.identity.fullName} />
                  <Confirmed label="Sex" value={person.identity.sex === "F" ? "Female" : "Male"} />
                  <Confirmed label="Born" value={person.identity.dateOfBirth} />
                  <Confirmed label="Nationality" value={person.identity.nationality} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Full legal name">
            <Input value={person.fullName} onChange={(e) => onUpdate({ fullName: e.target.value })} placeholder="As on passport" />
          </Field>
          <Field label="Passport number">
            <Input value={person.passportNo} onChange={(e) => onUpdate({ passportNo: e.target.value })} placeholder="A1234567" />
          </Field>
          <Field label="Nationality">
            <Input value={person.nationality} onChange={(e) => onUpdate({ nationality: e.target.value })} placeholder="Kenyan" />
          </Field>
        </div>
      )}

      {/* roles */}
      <div className="mt-5">
        <p className="text-label mb-2">Role in the company</p>
        <div className="flex flex-wrap items-center gap-2">
          {ROLES.map((r) => (
            <span key={r.id} className="inline-flex items-center gap-1">
              <Chip active={person.roles.includes(r.id)} onClick={() => toggleRole(r.id)}>
                {person.roles.includes(r.id) && <Check className="size-3.5" />}
                {r.label}
              </Chip>
              <InfoTip title={r.label}>{r.explain}</InfoTip>
            </span>
          ))}
        </div>
      </div>

      {/* TIN for directors */}
      {isDirector && (
        <div className="mt-4">
          <Field
            label="Director's TIN"
            hint={person.tinVerified ? undefined : "Directors need an individual TIN before incorporation."}
          >
            <div className="relative">
              <Input
                value={person.tin}
                onChange={(e) => verifyTin(e.target.value)}
                placeholder="123-456-789"
                className="pr-32 font-mono"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                {tinLoading ? (
                  <span className="inline-flex items-center gap-1 text-[0.72rem] text-fg-faint">
                    <Loader2 className="size-3.5 animate-spin" /> Verifying
                  </span>
                ) : person.tinVerified ? (
                  <span className="inline-flex items-center gap-1 text-[0.72rem] text-success">
                    <ShieldCheck className="size-3.5" /> Verified with TRA
                  </span>
                ) : person.tin.replace(/\D/g, "").length === 9 ? (
                  <span className="inline-flex items-center gap-1 text-[0.72rem] text-danger">
                    <X className="size-3.5" /> Not found
                  </span>
                ) : null}
              </span>
            </div>
          </Field>
        </div>
      )}

      {/* shares with live % */}
      {isShareholder && (
        <div className="mt-4 max-w-[260px]">
          <Field label="Shares held">
            <div className="relative">
              <Input
                inputMode="numeric"
                className="tnum pr-16"
                value={person.sharesHeld}
                onChange={(e) => onUpdate({ sharesHeld: Number(e.target.value.replace(/\D/g, "")) || 0 })}
              />
              <span className="tnum absolute right-3 top-1/2 -translate-y-1/2 text-[0.78rem] font-semibold text-tz-300">
                {totalShares > 0 ? `${((person.sharesHeld / totalShares) * 100).toFixed(((person.sharesHeld / totalShares) * 100) % 1 === 0 ? 0 : 1)}%` : "—"}
              </span>
            </div>
          </Field>
        </div>
      )}

      {/* contact (primary only) */}
      {person.isPrimaryContact && (
        <div className="mt-5 rounded-[var(--radius)] border border-tz-400/25 bg-tz-500/[0.05] p-4">
          <p className="text-section text-fg">Where we reach you</p>
          <p className="text-caption mt-0.5 mb-3">
            Government portals send one-time codes and payment requests during registration.
            We relay every one of them here — nothing goes unanswered.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email">
              <Input type="email" value={person.email} onChange={(e) => onUpdate({ email: e.target.value })} placeholder="you@company.co.tz" />
            </Field>
            <Field label="Phone (mobile money)">
              <Input value={person.phone} onChange={(e) => onUpdate({ phone: e.target.value })} placeholder="+255 7XX XXX XXX" />
            </Field>
          </div>
        </div>
      )}
    </div>
  );
}

function Confirmed({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex flex-col">
      <span className="text-[0.66rem] uppercase tracking-wide text-fg-faint">{label}</span>
      <span className="font-medium text-fg">{value}</span>
    </span>
  );
}
