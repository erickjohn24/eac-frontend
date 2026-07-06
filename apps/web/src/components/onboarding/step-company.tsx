"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, Loader2, Plus, Sparkles, X } from "lucide-react";
import { Field, Input, Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/chip";
import { InfoTip } from "@/components/ui/info-tip";
import { ISIC_ACTIVITIES, TANZANIA_REGIONS, formatTzs } from "@tz/shared";
import type { OnboardingState } from "@/lib/onboarding-types";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const COMMON_DISTRICTS = [
  "Ilala", "Kinondoni", "Temeke", "Ubungo", "Kigamboni", "Arusha City",
  "Moshi", "Dodoma City", "Mwanza City", "Mbeya City", "Morogoro",
];

export function StepCompany({
  state,
  patch,
}: {
  state: OnboardingState;
  patch: (p: Partial<OnboardingState>) => void;
}) {
  return (
    <div className="space-y-9">
      <Section n={1} title="Identity" hint="Your name on the register">
        <IdentityFields state={state} patch={patch} />
      </Section>

      <Section n={2} title="Where you operate" hint="Asked once — reused for your licence, workplace and bank">
        <LocationFields state={state} patch={patch} />
      </Section>

      <Section n={3} title="Structure" hint="How the company is owned">
        <StructureCard state={state} patch={patch} />
      </Section>
    </div>
  );
}

function Section({
  n,
  title,
  hint,
  children,
}: {
  n: number;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: (n - 1) * 0.08, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="mb-4 flex items-baseline gap-3">
        <span className="tnum font-display text-[0.95rem] text-tz-300">{String(n).padStart(2, "0")}</span>
        <div>
          <h2 className="text-section text-fg">{title}</h2>
          <p className="text-caption mt-0.5">{hint}</p>
        </div>
      </div>
      {children}
    </motion.section>
  );
}

/* ------------------------------- identity -------------------------------- */

function IdentityFields({
  state,
  patch,
}: {
  state: OnboardingState;
  patch: (p: Partial<OnboardingState>) => void;
}) {
  const [addingActivity, setAddingActivity] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);

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
    }, 450);
    return () => clearTimeout(debounce.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.name]);

  const alternatives = state.suggestedNames.filter((n) => n !== state.name);
  const remaining = ISIC_ACTIVITIES.filter((a) => !state.activities.some((sa) => sa.code === a.code));

  return (
    <div className="space-y-5">
      <Field label="Company name">
        <div className="relative">
          <Input
            value={state.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="Acme Digital Limited"
            className="pr-30"
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

      {alternatives.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-caption flex items-center gap-1.5">
            <Sparkles className="size-3 text-tz-300" /> Also available:
          </span>
          {alternatives.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => patch({ name: n })}
              className="rounded-full border border-hairline bg-panel-2 px-3 py-1 text-[0.8rem] text-fg-muted transition-colors hover:border-tz-400/40 hover:text-fg"
            >
              {n}
            </button>
          ))}
        </div>
      )}

      <div>
        <p className="text-label mb-2 flex items-center gap-1.5">
          Business activities
          <InfoTip title="Business activities">
            These become your company's registered objects and set which licence class
            applies. Pick everything you'll realistically do — adding one later means a
            BRELA amendment.
          </InfoTip>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {state.activities.map((a) => (
            <span
              key={a.code}
              className="inline-flex items-center gap-1.5 rounded-full border border-tz-400/30 bg-tz-500/12 px-3 py-1.5 text-[0.82rem]"
            >
              {a.label}
              <button
                onClick={() => patch({ activities: state.activities.filter((x) => x.code !== a.code) })}
                className="text-fg-faint transition-colors hover:text-danger"
                aria-label={`Remove ${a.label}`}
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
          <button
            onClick={() => setAddingActivity((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-hairline px-3 py-1.5 text-[0.82rem] text-fg-muted transition-colors hover:border-tz-400/40 hover:text-fg"
          >
            <Plus className="size-3.5" /> Add
          </button>
        </div>
        {addingActivity && (
          <SelectWrap className="mt-3">
            <Select
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
          </SelectWrap>
        )}
      </div>
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

/* ------------------------------- location -------------------------------- */

function LocationFields({
  state,
  patch,
}: {
  state: OnboardingState;
  patch: (p: Partial<OnboardingState>) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Region">
          <SelectWrap>
            <Select value={state.region} onChange={(e) => patch({ region: e.target.value })}>
              {TANZANIA_REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </SelectWrap>
        </Field>
        <Field label="District">
          <Input
            list="districts"
            value={state.district}
            onChange={(e) => patch({ district: e.target.value })}
            placeholder="Start typing…"
          />
          <datalist id="districts">
            {COMMON_DISTRICTS.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </Field>
      </div>
      <Field label="Registered office address">
        <Input
          value={state.physicalAddress}
          onChange={(e) => patch({ physicalAddress: e.target.value })}
          placeholder="Street / plot, building"
        />
      </Field>
    </div>
  );
}

/* ------------------------------ structure -------------------------------- */

function StructureCard({
  state,
  patch,
}: {
  state: OnboardingState;
  patch: (p: Partial<OnboardingState>) => void;
}) {
  const isStandard =
    state.shareCapitalTzs === 5_000_000 && state.totalShares === 100 && state.fyEndMonth === 12;
  const [open, setOpen] = useState(!isStandard);

  const parValue = state.totalShares > 0 ? Math.round(state.shareCapitalTzs / state.totalShares) : 0;

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 p-5 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[0.95rem] font-semibold text-fg">
              {isStandard ? "Standard private company" : "Custom structure"}
            </span>
            {isStandard && <Badge tone="tz">Recommended</Badge>}
          </div>
          <p className="tnum mt-1 text-[0.85rem] text-fg-muted">
            {formatTzs(state.shareCapitalTzs)} capital · {state.totalShares.toLocaleString("en-US")} shares
            · FY ends {MONTHS[state.fyEndMonth - 1]}
          </p>
          <p className="text-caption mt-1.5">
            The structure most Tanzanian private companies register with. You can change
            it any time before launch.
          </p>
        </div>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25 }}>
          <ChevronDown className="size-4 text-fg-faint" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-5 border-t border-hairline p-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field
                  label={
                    <LabelWithTip label="Share capital (TZS)">
                      The total value of your company's shares. It's not money you pay
                      anyone — it's how ownership is split. BRELA fees scale with it;
                      TSh 5,000,000 keeps you in the lowest band and looks credible to
                      banks. You rarely need to change this.
                    </LabelWithTip>
                  }
                >
                  <Input
                    inputMode="numeric"
                    className="tnum"
                    value={state.shareCapitalTzs.toLocaleString("en-US")}
                    onChange={(e) =>
                      patch({ shareCapitalTzs: Number(e.target.value.replace(/\D/g, "")) || 0 })
                    }
                  />
                </Field>
                <Field
                  label={
                    <LabelWithTip label="Total shares">
                      How the capital is divided. 100 shares makes ownership easy to read
                      — one share = 1%.
                    </LabelWithTip>
                  }
                >
                  <Input
                    inputMode="numeric"
                    className="tnum"
                    value={state.totalShares.toLocaleString("en-US")}
                    onChange={(e) =>
                      patch({ totalShares: Number(e.target.value.replace(/\D/g, "")) || 0 })
                    }
                  />
                </Field>
                <Field
                  label={
                    <LabelWithTip label="Financial year ends">
                      Sets your accounting period. December matches the government's year
                      and most Tanzanian businesses.
                    </LabelWithTip>
                  }
                >
                  <SelectWrap>
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
                  </SelectWrap>
                </Field>
              </div>
              <p className="text-caption tnum">
                Par value {formatTzs(parValue)} per share.
              </p>
              {!isStandard && (
                <button
                  type="button"
                  onClick={() => {
                    patch({ shareCapitalTzs: 5_000_000, totalShares: 100, fyEndMonth: 12 });
                  }}
                  className="text-[0.8rem] font-medium text-tz-300 hover:underline"
                >
                  Reset to the recommended structure
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LabelWithTip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {label}
      <InfoTip title={label}>{children}</InfoTip>
    </span>
  );
}

function SelectWrap({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative ${className ?? ""}`}>
      {children}
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-faint" />
    </div>
  );
}
