import { z } from "zod";

/** Zod schemas shared by web/mobile forms, tRPC input validation, and flows. */

export const ninSchema = z
  .string()
  .regex(/^\d{20}$/, "NIN must be exactly 20 digits");

export const tinSchema = z
  .string()
  .regex(/^\d{3}-?\d{3}-?\d{3}$/, "TIN must be 9 digits (e.g. 123-456-789)");

export const phoneSchema = z
  .string()
  .regex(/^\+255\d{9}$/, "Phone must be in +255XXXXXXXXX format");

export const personInput = z.object({
  fullName: z.string().min(3).max(120),
  roles: z.array(z.enum(["director", "shareholder", "secretary", "signatory"])).min(1),
  nationality: z.string().default("Tanzanian"),
  nin: ninSchema.optional(),
  tin: tinSchema.optional(),
  passportNo: z.string().min(5).max(20).optional(),
  email: z.string().email().optional(),
  phone: phoneSchema.optional(),
  sharesHeld: z.number().int().min(0).default(0),
});

export type PersonInput = z.infer<typeof personInput>;

export const companyProfileInput = z.object({
  name: z.string().min(3).max(120),
  alternativeNames: z.array(z.string().min(3).max(120)).max(2).default([]),
  region: z.string().min(2),
  district: z.string().min(2),
  physicalAddress: z.string().min(5),
  postalAddress: z.string().optional(),
  businessActivityIsic: z.array(z.string()).min(1, "Choose at least one activity"),
  activityDescription: z.string().min(10).max(500),
  shareCapitalTzs: z.number().int().min(20_000),
  totalShares: z.number().int().min(1),
  fyEndMonth: z.number().int().min(1).max(12).default(12),
  expectedAnnualTurnoverTzs: z.number().int().min(0).default(0),
  voluntaryVat: z.boolean().default(false),
  employeeCount: z.number().int().min(0).default(0),
  people: z.array(personInput).min(1, "At least one director is required"),
});

export type CompanyProfileInput = z.infer<typeof companyProfileInput>;

export const resolveActionItemInput = z.object({
  hitlId: z.string().uuid(),
  resolution: z.object({
    code: z.string().max(12).optional(),
    paymentRef: z.string().max(64).optional(),
    method: z.enum(["mpesa", "tigopesa", "airtel_money", "halopesa", "bank"]).optional(),
    documentId: z.string().uuid().optional(),
    confirmed: z.boolean().optional(),
    notes: z.string().max(1000).optional(),
  }),
});

export type ResolveActionItemInput = z.infer<typeof resolveActionItemInput>;

/** Validate the company profile is incorporation-ready (directors have NIN+TIN etc). */
export function incorporationReadiness(profile: CompanyProfileInput): {
  ready: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  const directors = profile.people.filter((p) => p.roles.includes("director"));
  if (directors.length === 0) issues.push("At least one director is required.");
  for (const d of directors) {
    const foreign = d.nationality.toLowerCase() !== "tanzanian";
    if (!foreign && !d.nin) issues.push(`${d.fullName}: NIN required for Tanzanian directors.`);
    if (foreign && !d.passportNo) issues.push(`${d.fullName}: passport required for foreign directors.`);
    if (!d.tin) issues.push(`${d.fullName}: directors need an individual TIN before incorporation.`);
  }
  const shareholders = profile.people.filter((p) => p.roles.includes("shareholder"));
  if (shareholders.length === 0) issues.push("At least one shareholder is required.");
  const allocated = shareholders.reduce((sum, s) => sum + s.sharesHeld, 0);
  if (allocated !== profile.totalShares) {
    issues.push(
      `Share allocation (${allocated}) must equal total shares (${profile.totalShares}).`,
    );
  }
  return { ready: issues.length === 0, issues };
}
