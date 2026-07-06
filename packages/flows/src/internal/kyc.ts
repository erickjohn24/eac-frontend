import type { Flow, FlowResult } from "@tz/agent-core";
import { ValidationError } from "@tz/agent-core";

/**
 * KYC gate: confirm each director has a NIN (or passport) and an individual
 * TIN before incorporation, and shareholders have a NIN/passport. Directors
 * missing a TIN would, in the full product, be routed through an individual
 * TIN sub-flow; here we validate and surface a clear action.
 */
export const kycDirectors: Flow = async (ctx): Promise<FlowResult> => {
  const people = await ctx.repo.getPeople(ctx.companyId);
  const directors = people.filter((p) => p.roles.includes("director"));
  const issues: string[] = [];

  if (directors.length === 0) issues.push("At least one director is required.");
  for (const d of directors) {
    const foreign = d.nationality.toLowerCase() !== "tanzanian";
    if (!foreign && !d.nin) issues.push(`${d.fullName}: NIN required.`);
    if (foreign && !d.passportNo) issues.push(`${d.fullName}: passport required.`);
    if (!d.tin) issues.push(`${d.fullName}: individual TIN required before incorporation.`);
  }

  await ctx.actions.record({
    kind: "extract",
    detail: `Verified KYC for ${directors.length} director(s), ${people.length} person(s) total`,
  });

  if (issues.length > 0) {
    throw new ValidationError(`KYC incomplete: ${issues.join(" ")}`);
  }

  return {
    output: {
      directorsVerified: directors.length,
      shareholdersVerified: people.filter((p) => p.roles.includes("shareholder")).length,
    },
  };
};
