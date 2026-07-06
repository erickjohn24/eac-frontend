import type { HITLType, PortalId } from "./types.js";

/**
 * The Tanzania company-registration pipeline as a declarative step graph.
 * The engine interprets this graph: a step becomes ready when all `deps`
 * have succeeded (or been skipped) and its `condition` (if any) holds.
 */

export type StepKind = "portal" | "internal" | "concierge" | "fulfillment";

export interface StepDef {
  id: string;
  title: string;
  titleSw: string;
  description: string;
  kind: StepKind;
  portal?: PortalId;
  deps: string[];
  /** HITL gates this step is known to raise */
  hitl?: HITLType[];
  /** key into StepConditionInput evaluated by the engine */
  condition?: StepConditionId;
  /** typical duration shown in the UI */
  etaDays: [min: number, max: number];
  /** government fees in TZS, when known up front (display only) */
  feeTzs?: [min: number, max: number];
}

export type StepConditionId = "vat_required" | "has_employees";

export interface StepConditionInput {
  expectedAnnualTurnoverTzs: number;
  voluntaryVat: boolean;
  employeeCount: number;
}

export const STEP_CONDITIONS: Record<
  StepConditionId,
  (input: StepConditionInput) => boolean
> = {
  vat_required: (i) => i.voluntaryVat || i.expectedAnnualTurnoverTzs > 200_000_000,
  has_employees: (i) => i.employeeCount > 0,
};

export const PIPELINE_VERSION = 1;

export const PIPELINE_STEPS: StepDef[] = [
  {
    id: "kyc.directors",
    title: "Director & shareholder KYC",
    titleSw: "Uthibitisho wa wakurugenzi na wanahisa",
    description:
      "Verify each director's NIN and TIN and each shareholder's NIN (or passport for foreigners). Directors without a TIN are guided through individual TIN registration first.",
    kind: "internal",
    deps: [],
    etaDays: [0, 2],
  },
  {
    id: "brela.name_reservation",
    title: "Company name search & reservation",
    titleSw: "Utafutaji na uhifadhi wa jina la kampuni",
    description:
      "Search the BRELA registry for availability and reserve the chosen name. Fee is paid via a GePG control number.",
    kind: "portal",
    portal: "brela_ors",
    deps: [],
    hitl: ["captcha_handoff", "otp_entry", "payment_authorization"],
    etaDays: [1, 3],
    feeTzs: [50_000, 50_000],
  },
  {
    id: "docs.memarts",
    title: "Draft Memorandum & Articles",
    titleSw: "Kuandaa Katiba ya Kampuni (Memarts)",
    description:
      "Generate the Memorandum & Articles of Association, Declaration of Compliance and first board resolution from your company profile.",
    kind: "internal",
    deps: ["brela.name_reservation"],
    etaDays: [0, 1],
  },
  {
    id: "brela.incorporation",
    title: "Company incorporation at BRELA",
    titleSw: "Usajili wa kampuni BRELA",
    description:
      "File the incorporation with Memarts and director/shareholder details on BRELA ORS, pay registration fees, and receive the Certificate of Incorporation.",
    kind: "portal",
    portal: "brela_ors",
    deps: ["kyc.directors", "docs.memarts"],
    hitl: ["payment_authorization"],
    etaDays: [3, 14],
    feeTzs: [200_000, 300_000],
  },
  {
    id: "tra.company_tin",
    title: "Company TIN registration",
    titleSw: "Usajili wa TIN ya kampuni",
    description:
      "Register the company for a Taxpayer Identification Number with TRA. A one-time biometric visit by a director is required to finalize.",
    kind: "portal",
    portal: "tra",
    deps: ["brela.incorporation"],
    hitl: ["otp_entry", "physical_visit"],
    etaDays: [1, 5],
    feeTzs: [0, 0],
  },
  {
    id: "licence.application",
    title: "Business licence",
    titleSw: "Leseni ya biashara",
    description:
      "Apply for the business licence — Class A via the National Business Portal or Class B via TAUSI depending on your activity. Requires TIN certificate and premises details.",
    kind: "portal",
    portal: "tnbp",
    deps: ["tra.company_tin"],
    hitl: ["document_upload", "payment_authorization"],
    etaDays: [3, 10],
  },
  {
    id: "tra.vat",
    title: "VAT registration",
    titleSw: "Usajili wa VAT",
    description:
      "Register for VAT (mandatory above TZS 200M annual turnover, or voluntarily). TRA performs a physical verification visit before activation.",
    kind: "portal",
    portal: "tra",
    deps: ["tra.company_tin"],
    hitl: ["physical_visit"],
    condition: "vat_required",
    etaDays: [5, 14],
    feeTzs: [0, 0],
  },
  {
    id: "nssf.register",
    title: "NSSF employer registration",
    titleSw: "Usajili wa mwajiri NSSF",
    description:
      "Register as an employer with the National Social Security Fund (20% of gross salaries, typically split 10/10).",
    kind: "portal",
    portal: "nssf",
    deps: ["tra.company_tin"],
    condition: "has_employees",
    etaDays: [1, 3],
    feeTzs: [0, 0],
  },
  {
    id: "wcf.register",
    title: "WCF employer registration",
    titleSw: "Usajili wa mwajiri WCF",
    description:
      "Register with the Workers Compensation Fund (0.5% of monthly wage bill).",
    kind: "portal",
    portal: "wcf",
    deps: ["tra.company_tin"],
    condition: "has_employees",
    etaDays: [1, 3],
    feeTzs: [0, 0],
  },
  {
    id: "osha.register",
    title: "OSHA workplace registration",
    titleSw: "Usajili wa mahali pa kazi OSHA",
    description:
      "Register the workplace with OSHA before commencing operations. An inspection precedes the annual compliance licence.",
    kind: "portal",
    portal: "osha",
    deps: ["tra.company_tin"],
    condition: "has_employees",
    hitl: ["physical_visit"],
    etaDays: [3, 14],
    feeTzs: [0, 0],
  },
  {
    id: "bank.account",
    title: "Corporate bank account",
    titleSw: "Akaunti ya benki ya kampuni",
    description:
      "We prepare the complete bank pack (certificate, Memarts, board resolution, TIN, licence, signatory IDs) and book your branch appointment. Signatories attend once; the account opens in 1–3 days.",
    kind: "concierge",
    deps: ["brela.incorporation", "tra.company_tin", "licence.application"],
    hitl: ["appointment", "physical_visit"],
    etaDays: [1, 3],
    feeTzs: [150_000, 200_000],
  },
  {
    id: "stamp.order",
    title: "Company stamp",
    titleSw: "Muhuri wa kampuni",
    description:
      "Order the company rubber stamp from a vetted Dar es Salaam vendor with delivery tracking.",
    kind: "fulfillment",
    deps: ["brela.incorporation"],
    etaDays: [1, 2],
    feeTzs: [15_000, 80_000],
  },
  {
    id: "compliance.activate",
    title: "Compliance autopilot activation",
    titleSw: "Kuwasha mfumo wa uzingatiaji",
    description:
      "Your compliance calendar goes live: PAYE/SDL, VAT, NSSF, WCF, annual returns and renewals are scheduled, monitored and filed automatically.",
    kind: "internal",
    deps: ["bank.account", "licence.application"],
    etaDays: [0, 0],
  },
];

export interface PipelineDef {
  version: number;
  steps: StepDef[];
}

export const PIPELINE: PipelineDef = {
  version: PIPELINE_VERSION,
  steps: PIPELINE_STEPS,
};

const stepIndex = new Map(PIPELINE_STEPS.map((s) => [s.id, s]));

export function getStep(id: string): StepDef {
  const step = stepIndex.get(id);
  if (!step) throw new Error(`Unknown pipeline step: ${id}`);
  return step;
}

/** Validates the graph is acyclic and all deps exist. Throws on invalid. */
export function validatePipeline(def: PipelineDef = PIPELINE): void {
  const ids = new Set(def.steps.map((s) => s.id));
  for (const step of def.steps) {
    for (const dep of step.deps) {
      if (!ids.has(dep)) {
        throw new Error(`Step ${step.id} depends on unknown step ${dep}`);
      }
    }
  }
  // Kahn's algorithm for cycle detection
  const inDegree = new Map<string, number>();
  for (const s of def.steps) inDegree.set(s.id, s.deps.length);
  const queue = def.steps.filter((s) => s.deps.length === 0).map((s) => s.id);
  let visited = 0;
  while (queue.length > 0) {
    const id = queue.shift()!;
    visited++;
    for (const s of def.steps) {
      if (s.deps.includes(id)) {
        const d = inDegree.get(s.id)! - 1;
        inDegree.set(s.id, d);
        if (d === 0) queue.push(s.id);
      }
    }
  }
  if (visited !== def.steps.length) {
    throw new Error("Pipeline step graph contains a cycle");
  }
}

/**
 * Given the set of terminal step statuses, return steps that are ready to run.
 * A step is ready when every dep has succeeded or been skipped, it has not
 * itself started, and its condition (if any) holds.
 */
export function readySteps(
  statuses: Map<string, string>,
  conditionInput: StepConditionInput,
  def: PipelineDef = PIPELINE,
): StepDef[] {
  return def.steps.filter((step) => {
    const status = statuses.get(step.id) ?? "pending";
    if (status !== "pending" && status !== "blocked") return false;
    if (step.condition && !STEP_CONDITIONS[step.condition](conditionInput)) {
      return false;
    }
    return step.deps.every((dep) => {
      const depStatus = statuses.get(dep);
      if (depStatus === "succeeded") return true;
      // deps that were conditionally skipped don't block dependents
      if (depStatus === "skipped") return true;
      const depDef = getStep(dep);
      if (
        depDef.condition &&
        !STEP_CONDITIONS[depDef.condition](conditionInput)
      ) {
        return true;
      }
      return false;
    });
  });
}
