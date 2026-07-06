import { getStep, type StepDef } from "@tz/shared";

/**
 * Dashboard derivations: company status pills, journey progress, and the
 * registration timeline model. Pure functions — the server page queries,
 * these shape, the components render.
 */

/* ------------------------------ status pill ------------------------------ */

export type PillTone = "neutral" | "success" | "warning" | "danger" | "tz";

export function statusPill(status: string): { label: string; tone: PillTone } {
  switch (status) {
    case "draft":
      return { label: "Preparing documents", tone: "neutral" };
    case "ready_to_file":
      return { label: "Ready to file", tone: "tz" };
    case "in_pipeline":
      return { label: "Registration in progress", tone: "tz" };
    case "registered":
      return { label: "Registered", tone: "success" };
    case "compliant":
      return { label: "Compliant", tone: "success" };
    case "at_risk":
      return { label: "Needs attention", tone: "warning" };
    default:
      return { label: status.replace(/_/g, " "), tone: "neutral" };
  }
}

/* ------------------------------ plan & ETA -------------------------------- */

/** The registration journey in display order. Conditional steps apply only
 *  when the company has employees. */
const PLAN_IDS = [
  "kyc.directors",
  "brela.name_reservation",
  "docs.memarts",
  "brela.incorporation",
  "tra.company_tin",
  "licence.application",
  "nssf.register",
  "wcf.register",
  "osha.register",
  "bank.account",
  "stamp.order",
  "compliance.activate",
] as const;

const EMPLOYEE_ONLY = new Set(["nssf.register", "wcf.register", "osha.register"]);

export function planSteps(employeeCount: number): StepDef[] {
  return PLAN_IDS.filter((id) => employeeCount > 0 || !EMPLOYEE_ONLY.has(id)).map(
    (id) => getStep(id),
  );
}

export function etaLabel([min, max]: [number, number]): string {
  if (max === 0) return "same day";
  if (min === max) return `${max} day${max === 1 ? "" : "s"}`;
  if (min === 0) return `up to ${max} days`;
  return `${min}–${max} days`;
}

/** What each step needs from the founder, in founder terms. Only steps that
 *  raise HITL gates get a note. */
const NEEDS_YOU: Record<string, string> = {
  "brela.name_reservation": "one payment approval from your phone",
  "brela.incorporation": "one payment approval from your phone",
  "tra.company_tin": "one biometrics visit by a director",
  "licence.application": "your lease upload and one payment approval",
  "osha.register": "an inspection of your premises",
  "bank.account": "one branch visit by your signatories",
};

export function needsYouNote(step: StepDef): string | undefined {
  if (!step.hitl || step.hitl.length === 0) return undefined;
  return NEEDS_YOU[step.id];
}

/* ------------------------------- progress -------------------------------- */

export interface SignatureTally {
  total: number;
  signed: number;
}

/** Overall journey progress: the signing gate plus every applicable pipeline
 *  step, weighted equally. */
export function computeProgress(
  employeeCount: number,
  stepStatuses: Map<string, string> | null,
  signatures: SignatureTally,
): number {
  const plan = planSteps(employeeCount);
  const total = plan.length + 1; // +1 for the signing gate
  let done = 0;
  if (stepStatuses) {
    done = 1; // filing started, so signing is behind us
    for (const step of plan) {
      if (stepStatuses.get(step.id) === "succeeded") done++;
    }
  } else if (signatures.total > 0 && signatures.signed === signatures.total) {
    done = 1;
  }
  return Math.round((done / total) * 100);
}

/* ------------------------------- timeline -------------------------------- */

export interface TimelineAction {
  title: string;
  instructions: string;
}

export interface TimelineItem {
  id: string;
  title: string;
  state: "done" | "active" | "waiting";
  /** milestone line under the title, for active steps */
  statusText?: string;
  /** "Needs you: …" caption, from the step's HITL gates */
  needsYou?: string;
  /** ETA chip, e.g. "3–14 days" */
  eta?: string;
  /** open HITL request attached to this step */
  action?: TimelineAction;
}

export interface TimelineModel {
  items: TimelineItem[];
  /** note shown above the timeline, e.g. the ready-to-file hint */
  note?: string;
}

function governmentName(step: StepDef): string {
  switch (step.portal) {
    case "brela_ors":
      return "BRELA";
    case "tra":
      return "TRA";
    case "nssf":
      return "NSSF";
    case "wcf":
      return "WCF";
    case "osha":
      return "OSHA";
    case "tnbp":
    case "tausi":
      return "the licensing authority";
    default:
      return "the government";
  }
}

function activeStatusText(step: StepDef, runStatus: string): string {
  switch (runStatus) {
    case "awaiting_govt":
      return `Filed with ${governmentName(step)} — waiting on the government (usually ${etaLabel(step.etaDays)})`;
    case "awaiting_human":
      return NEEDS_YOU[step.id]
        ? `Waiting on you — ${NEEDS_YOU[step.id]}`
        : "Waiting on you — see the action below";
    case "failed":
      return "We're sorting out a hiccup on our side — nothing needed from you";
    default: {
      // running
      switch (step.kind) {
        case "portal":
          return `Our agents are on the ${governmentName(step)} portal now`;
        case "concierge":
          return "Our team is preparing this now";
        case "fulfillment":
          return "Being prepared for delivery";
        default:
          return "We're working on this now";
      }
    }
  }
}

export function buildTimeline(opts: {
  employeeCount: number;
  companyStatus: string;
  /** stepId → step_run status; null when no pipeline run exists yet */
  stepStatuses: Map<string, string> | null;
  signatures: SignatureTally;
  /** open HITL requests keyed by stepId */
  openActions: Map<string, TimelineAction>;
}): TimelineModel {
  const { employeeCount, companyStatus, stepStatuses, signatures, openActions } = opts;
  const plan = planSteps(employeeCount);
  const items: TimelineItem[] = [];
  let note: string | undefined;

  if (!stepStatuses) {
    // Pre-flight: nothing has run yet. Lead with the one thing that can
    // move today — signatures — or say plainly that nothing is needed.
    if (signatures.total > 0 && signatures.signed < signatures.total) {
      items.push({
        id: "sign.documents",
        title: "Sign your documents",
        state: "active",
        statusText: `${signatures.signed} of ${signatures.total} signed — we file the moment the last signature lands`,
        eta: "today",
      });
    } else if (signatures.total > 0) {
      items.push({
        id: "sign.documents",
        title: "Sign your documents",
        state: "done",
        eta: "done",
      });
    } else {
      items.push({
        id: "docs.preparing",
        title: "We're preparing your documents",
        state: "active",
        statusText: "Signature links for each director appear here in a few moments",
        eta: "minutes",
      });
    }
    if (companyStatus === "ready_to_file") {
      note = "Waiting for our agents to start — nothing needed from you.";
    }
    for (const step of plan) {
      items.push({
        id: step.id,
        title: step.title,
        state: "waiting",
        needsYou: needsYouNote(step),
        eta: etaLabel(step.etaDays),
        action: openActions.get(step.id),
      });
    }
    return { items, note };
  }

  // A pipeline run exists: mirror its step statuses.
  for (const step of plan) {
    const runStatus = stepStatuses.get(step.id) ?? "pending";
    if (runStatus === "skipped") continue;
    const state: TimelineItem["state"] =
      runStatus === "succeeded"
        ? "done"
        : runStatus === "running" ||
            runStatus === "awaiting_human" ||
            runStatus === "awaiting_govt" ||
            runStatus === "failed"
          ? "active"
          : "waiting";
    items.push({
      id: step.id,
      title: step.title,
      state,
      statusText: state === "active" ? activeStatusText(step, runStatus) : undefined,
      needsYou: state === "done" ? undefined : needsYouNote(step),
      eta: state === "done" ? undefined : etaLabel(step.etaDays),
      action: openActions.get(step.id),
    });
  }
  if (items.every((i) => i.state === "done")) {
    note = "All done — your company is registered and compliance is live.";
  }
  return { items, note };
}

/* ------------------------------ formatting -------------------------------- */

const DAY_MONTH = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const FULL_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatDayMonth(d: Date): string {
  // include the year when it isn't this year, so "1 Jul" can't mislead
  if (d.getFullYear() !== new Date().getFullYear()) return FULL_DATE.format(d);
  return DAY_MONTH.format(d);
}

export function formatFullDate(d: Date): string {
  return FULL_DATE.format(d);
}

export function formatKb(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
