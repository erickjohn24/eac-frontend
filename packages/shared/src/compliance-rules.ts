import type { ObligationCadence, ObligationType } from "./types.js";

/**
 * The Tanzania continuous-compliance rules catalog (mainland, 2025/26).
 * Deadlines and rates verified against TRA/NSSF/WCF/BRELA guidance —
 * re-verify against the current-year tax guide before live filings.
 */

export interface ComplianceRule {
  type: ObligationType;
  title: string;
  titleSw: string;
  authority: "TRA" | "NSSF" | "WCF" | "OSHA" | "BRELA" | "LGA/MIT";
  cadence: ObligationCadence;
  /**
   * Due-date rule:
   *  - monthly: day of the FOLLOWING month the filing/payment is due
   *  - quarterly: dueDates gives month/day pairs within the fiscal year
   *  - annual: anchored to fiscal-year end or incorporation anniversary
   */
  due:
    | { kind: "monthly"; dayOfFollowingMonth: number }
    | { kind: "quarterly"; note: string }
    | { kind: "annual"; anchor: "fy_end"; offsetMonths: number }
    | { kind: "annual"; anchor: "incorporation_anniversary"; withinDays: number }
    | { kind: "annual"; anchor: "issue_date"; note: string }
    | { kind: "event"; withinDays: number; note: string };
  /** whether the platform can file this automatically via a portal flow */
  autoFileCapable: boolean;
  appliesIf?: "has_employees" | "vat_registered" | "sdl_threshold";
  rate?: string;
  penalty: string;
  penaltySw?: string;
}

export const COMPLIANCE_RULES: ComplianceRule[] = [
  {
    type: "paye_sdl",
    title: "PAYE + SDL monthly return",
    titleSw: "Ritani ya kila mwezi ya PAYE na SDL",
    authority: "TRA",
    cadence: "monthly",
    due: { kind: "monthly", dayOfFollowingMonth: 7 },
    autoFileCapable: true,
    appliesIf: "has_employees",
    rate: "PAYE per bands; SDL 3.5% of gross emoluments (10+ employees)",
    penalty:
      "Late filing: higher of ~TZS 300,000 (15 currency points) or 2.5% of tax due, per month, plus interest at the BoT rate.",
  },
  {
    type: "vat_return",
    title: "VAT monthly return",
    titleSw: "Ritani ya VAT ya kila mwezi",
    authority: "TRA",
    cadence: "monthly",
    due: { kind: "monthly", dayOfFollowingMonth: 20 },
    autoFileCapable: true,
    appliesIf: "vat_registered",
    rate: "18% (mainland)",
    penalty:
      "Late filing: higher of ~TZS 300,000 or 2.5% of tax due per month, plus interest.",
  },
  {
    type: "provisional_tax",
    title: "Provisional income tax instalment",
    titleSw: "Awamu ya kodi ya mapato ya makadirio",
    authority: "TRA",
    cadence: "quarterly",
    due: {
      kind: "quarterly",
      note: "Statement within 3 months of year start; instalments due at the end of quarters 1–4 (calendar FY: Mar 31, Jun 30, Sep 30, Dec 31).",
    },
    autoFileCapable: true,
    rate: "CIT 30% on estimated profit",
    penalty:
      "Interest applies if the estimate falls below 80% of the final liability; late-payment interest at BoT rate.",
  },
  {
    type: "final_return",
    title: "Final income tax return",
    titleSw: "Ritani ya mwisho ya kodi ya mapato",
    authority: "TRA",
    cadence: "annual",
    due: { kind: "annual", anchor: "fy_end", offsetMonths: 6 },
    autoFileCapable: true,
    rate: "CIT 30%",
    penalty: "Late-filing penalty plus interest on unpaid tax.",
  },
  {
    type: "nssf_contribution",
    title: "NSSF monthly contribution",
    titleSw: "Mchango wa NSSF wa kila mwezi",
    authority: "NSSF",
    cadence: "monthly",
    due: { kind: "monthly", dayOfFollowingMonth: 30 },
    autoFileCapable: true,
    appliesIf: "has_employees",
    rate: "20% of gross salary (commonly 10% employer / 10% employee)",
    penalty: "5% of the unpaid amount per month of delay.",
  },
  {
    type: "wcf_contribution",
    title: "WCF monthly contribution",
    titleSw: "Mchango wa WCF wa kila mwezi",
    authority: "WCF",
    cadence: "monthly",
    due: { kind: "monthly", dayOfFollowingMonth: 30 },
    autoFileCapable: true,
    appliesIf: "has_employees",
    rate: "0.5% of monthly wage bill (private sector)",
    penalty: "Penalties and interest accrue on late payment.",
  },
  {
    type: "osha_annual",
    title: "OSHA annual compliance licence",
    titleSw: "Leseni ya mwaka ya OSHA",
    authority: "OSHA",
    cadence: "annual",
    due: { kind: "annual", anchor: "issue_date", note: "Renew annually after inspection." },
    autoFileCapable: false,
    appliesIf: "has_employees",
    penalty: "Operating without a compliance licence is an offence.",
  },
  {
    type: "brela_annual_return",
    title: "BRELA annual return",
    titleSw: "Ritani ya mwaka ya BRELA",
    authority: "BRELA",
    cadence: "annual",
    due: { kind: "annual", anchor: "incorporation_anniversary", withinDays: 28 },
    autoFileCapable: true,
    penalty:
      "Administrative late-filing penalties; persistent default risks striking off the register.",
  },
  {
    type: "beneficial_ownership",
    title: "Beneficial ownership update",
    titleSw: "Taarifa za wamiliki wa manufaa",
    authority: "BRELA",
    cadence: "event",
    due: {
      kind: "event",
      withinDays: 30,
      note: "File within 30 days of any change in beneficial ownership.",
    },
    autoFileCapable: true,
    penalty:
      "Non-filing freezes ALL registrar transactions; fines up to TZS 5,000,000.",
  },
  {
    type: "licence_renewal",
    title: "Business licence renewal",
    titleSw: "Uhuishaji wa leseni ya biashara",
    authority: "LGA/MIT",
    cadence: "annual",
    due: { kind: "annual", anchor: "issue_date", note: "Renew before expiry each year." },
    autoFileCapable: true,
    penalty: "Operating on an expired licence attracts penalties.",
  },
];

export function getComplianceRule(type: ObligationType): ComplianceRule {
  const rule = COMPLIANCE_RULES.find((r) => r.type === type);
  if (!rule) throw new Error(`Unknown compliance rule: ${type}`);
  return rule;
}

export interface CompanyComplianceProfile {
  hasEmployees: boolean;
  vatRegistered: boolean;
  fyEndMonth: number; // 1-12
  incorporationDate: string; // ISO date
  licenceIssueDate?: string;
  oshaIssueDate?: string;
}

/** Which rules apply to a company given its profile. */
export function applicableRules(
  profile: CompanyComplianceProfile,
): ComplianceRule[] {
  return COMPLIANCE_RULES.filter((rule) => {
    if (rule.appliesIf === "has_employees" && !profile.hasEmployees) return false;
    if (rule.appliesIf === "vat_registered" && !profile.vatRegistered) return false;
    if (rule.appliesIf === "sdl_threshold" && !profile.hasEmployees) return false;
    return true;
  });
}

/**
 * Compute the next due date for a rule from a reference date.
 * Pure and deterministic so both worker and UIs agree.
 */
export function nextDueDate(
  rule: ComplianceRule,
  profile: CompanyComplianceProfile,
  from: Date,
): Date | null {
  const d = rule.due;
  switch (d.kind) {
    case "monthly": {
      // due on day N of the month following the reference period
      const due = new Date(
        Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, Math.min(d.dayOfFollowingMonth, 28)),
      );
      if (d.dayOfFollowingMonth === 30) {
        // "end of following month" semantics
        due.setUTCMonth(due.getUTCMonth() + 1, 0);
      }
      return due;
    }
    case "quarterly": {
      const quarterEndMonths = [2, 5, 8, 11]; // Mar, Jun, Sep, Dec (0-indexed)
      for (const m of quarterEndMonths) {
        const due = new Date(Date.UTC(from.getUTCFullYear(), m + 1, 0));
        if (due > from) return due;
      }
      return new Date(Date.UTC(from.getUTCFullYear() + 1, 3, 0));
    }
    case "annual": {
      if (d.anchor === "fy_end") {
        const fyEnd = new Date(Date.UTC(from.getUTCFullYear(), profile.fyEndMonth, 0));
        const due = new Date(fyEnd);
        due.setUTCMonth(due.getUTCMonth() + d.offsetMonths);
        if (due > from) return due;
        due.setUTCFullYear(due.getUTCFullYear() + 1);
        return due;
      }
      if (d.anchor === "incorporation_anniversary") {
        const inc = new Date(profile.incorporationDate);
        const due = new Date(
          Date.UTC(from.getUTCFullYear(), inc.getUTCMonth(), inc.getUTCDate()),
        );
        due.setUTCDate(due.getUTCDate() + d.withinDays);
        if (due > from) return due;
        due.setUTCFullYear(due.getUTCFullYear() + 1);
        return due;
      }
      if (d.anchor === "issue_date") {
        const issue =
          rule.type === "osha_annual" ? profile.oshaIssueDate : profile.licenceIssueDate;
        if (!issue) return null;
        const issued = new Date(issue);
        const due = new Date(issued);
        due.setUTCFullYear(due.getUTCFullYear() + 1);
        while (due <= from) due.setUTCFullYear(due.getUTCFullYear() + 1);
        return due;
      }
      return null;
    }
    case "event":
      return null; // event-driven, materialized when the event occurs
  }
}
