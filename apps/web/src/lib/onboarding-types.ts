import type { NidaIdentity } from "@tz/shared";

export type Role = "director" | "shareholder" | "signatory";

export interface OnboardingPerson {
  id: string;
  /** filled from NIDA (Tanzanian) or entered (foreign) */
  identity?: NidaIdentity;
  isForeign: boolean;
  nin: string;
  passportNo: string;
  fullName: string; // from NIDA or typed for foreigners
  nationality: string;
  roles: Role[];
  tin: string;
  tinVerified: boolean;
  tinRegisteredName?: string;
  sharesHeld: number;
  email: string;
  phone: string;
  isPrimaryContact: boolean;
}

export interface OnboardingState {
  // Step 1 — vision
  pitch: string;
  summary?: string;
  aiSource?: "ai" | "heuristic";
  // Step 2 — company
  name: string;
  nameStatus?: "available" | "taken" | "advice" | "invalid" | "checking";
  suggestedNames: string[];
  activities: { code: string; label: string }[];
  activityDescription: string;
  region: string;
  district: string;
  physicalAddress: string;
  shareCapitalTzs: number;
  totalShares: number;
  fyEndMonth: number;
  vatLikely: boolean;
  employeesLikely: boolean;
  expectedAnnualTurnoverTzs: number;
  employeeCount: number;
  // Step 3 — people
  people: OnboardingPerson[];
}

export function emptyState(): OnboardingState {
  return {
    pitch: "",
    name: "",
    suggestedNames: [],
    activities: [],
    activityDescription: "",
    region: "Dar es Salaam",
    district: "",
    physicalAddress: "",
    shareCapitalTzs: 5_000_000,
    totalShares: 100,
    fyEndMonth: 12,
    vatLikely: false,
    employeesLikely: false,
    expectedAnnualTurnoverTzs: 0,
    employeeCount: 0,
    people: [],
  };
}

export function newPerson(): OnboardingPerson {
  return {
    id: Math.random().toString(36).slice(2),
    isForeign: false,
    nin: "",
    passportNo: "",
    fullName: "",
    nationality: "Tanzanian",
    roles: ["director", "shareholder"],
    tin: "",
    tinVerified: false,
    sharesHeld: 0,
    email: "",
    phone: "",
    isPrimaryContact: false,
  };
}
