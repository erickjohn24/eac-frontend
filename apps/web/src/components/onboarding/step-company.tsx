"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Plus, Sparkles, X } from "lucide-react";
import { Field, Input, Select } from "@/components/ui/field";
import { Chip, Badge } from "@/components/ui/chip";
import { ISIC_ACTIVITIES, TANZANIA_REGIONS, formatTzs } from "@tz/shared";
import type { OnboardingState } from "@/lib/onboarding-types";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export function StepCompany({
  state,
  patch,
}: {
  state: OnboardingState;
  patch: (p: Partial<OnboardingState>) => void;
}) {
  const [addingActivity, setAddingActivity] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  // live name availability
  useEffect(() => {
    if (state.name.trim().length < 3) {
      patch({ nameStatus: undefined });
      return;
    }
    patch({ nameStatus: "checking" });
    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/name-check", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: state.name }),
        });
        const data = await res.json();
        patch({ nameStatus: data.status });
      } catch {
        patch({ nameStatus: undefined });
      }
    }, 500);
    return () => clearTimeout(debounce.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.name]);

  const remaining = ISIC_ACTIVITIES.filter(
    (a) => !state.activities.some((sa) => sa.code === a.code),
  );

  return (
    <div className="space-y-7">
      {/* name */}
      <Field label="Company name">
        <div className="relative">
          <Input
            value={state.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="Acme Digital Limited"
            className="pr-28"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <NameBadge status={state.nameStatus} />
          </div>
        </div>
        {state.nameStatus === "advice" && (
          <span className="mt-1.5 block text-[0.78rem] text-warning">
            A private company name must end in “Limited”.
          </span>
        )}
      </Field>

      {state.suggestedNames.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[0.78rem] text-tz-300">
            <Sparkles className="size-3.5" /> AI name ideas
          </p>
          <div className="flex flex-wrap gap-2">
            {state.suggestedNames.map((n) => (
              <Chip key={n} active={state.name === n} onClick={() => patch({ name: n })}>
                {n}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {/* activities */}
      <div>
        <p className="mb-2 text-[0.8rem] font-medium text-fg-muted">Business activities</p>
        <div className="flex flex-wrap items-center gap-2">
          {state.activities.map((a) => (
            <span
              key={a.code}
              className="inline-flex items-center gap-1.5 rounded-full border border-tz-400/30 bg-tz-500/12 px-3 py-1.5 text-[0.82rem]"
            >
              {a.label}
              <button
                onClick={() => patch({ activities: state.activities.filter((x) => x.code !== a.code) })}
                className="text-fg-faint hover:text-danger"
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
          <button
            onClick={() => setAddingActivity((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-hairline px-3 py-1.5 text-[0.82rem] text-fg-muted hover:border-tz-400/40 hover:text-fg"
          >
            <Plus className="size-3.5" /> Add
          </button>
        </div>
        {addingActivity && (
          <Select
            className="mt-3"
            onChange={(e) => {
              const found = ISIC_ACTIVITIES.find((a) => a.code === e.target.value);
              if (found) patch({ activities: [...state.activities, found] });
              setAddingActivity(false);
            }}
            defaultValue=""
          >
            <option value="" disabled>
              Choose an activity…
            </option>
            {remaining.map((a) => (
              <option key={a.code} value={a.code}>
                {a.label}
              </option>
            ))}
          </Select>
        )}
      </div>

      {/* location — asked once, reused for registered office, workplace & bank */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Region">
          <Select value={state.region} onChange={(e) => patch({ region: e.target.value })}>
            {TANZANIA_REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="District / Ward">
          <Input
            value={state.district}
            onChange={(e) => patch({ district: e.target.value })}
            placeholder="Ilala"
          />
        </Field>
      </div>
      <Field label="Registered office address" hint="We reuse this for your workplace and bank — you'll never re-enter it.">
        <Input
          value={state.physicalAddress}
          onChange={(e) => patch({ physicalAddress: e.target.value })}
          placeholder="Plot 12, Nyerere Road"
        />
      </Field>

      {/* capital */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Share capital (TZS)">
          <Input
            inputMode="numeric"
            value={state.shareCapitalTzs.toLocaleString("en-US")}
            onChange={(e) => patch({ shareCapitalTzs: Number(e.target.value.replace(/\D/g, "")) || 0 })}
          />
        </Field>
        <Field label="Total shares">
          <Input
            inputMode="numeric"
            value={state.totalShares}
            onChange={(e) => patch({ totalShares: Number(e.target.value.replace(/\D/g, "")) || 0 })}
          />
        </Field>
        <Field label="Financial year ends">
          <Select
            value={state.fyEndMonth}
            onChange={(e) => patch({ fyEndMonth: Number(e.target.value) })}
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <p className="text-[0.8rem] text-fg-faint">
        {formatTzs(state.shareCapitalTzs)} across {state.totalShares || 0} shares —{" "}
        {state.totalShares ? formatTzs(Math.round(state.shareCapitalTzs / state.totalShares)) : "—"} par value.
      </p>
    </div>
  );
}

function NameBadge({ status }: { status?: OnboardingState["nameStatus"] }) {
  if (status === "checking")
    return (
      <Badge tone="neutral">
        <Loader2 className="size-3 animate-spin" /> Checking
      </Badge>
    );
  if (status === "available")
    return (
      <Badge tone="success">
        <Check className="size-3" /> Available
      </Badge>
    );
  if (status === "taken")
    return (
      <Badge tone="danger">
        <X className="size-3" /> Taken
      </Badge>
    );
  return null;
}
