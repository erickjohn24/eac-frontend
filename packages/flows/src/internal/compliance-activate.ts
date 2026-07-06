import type { Flow, FlowResult } from "@tz/agent-core";

/**
 * Final step: mark the company registered and signal that the compliance
 * scheduler should provision the ongoing obligation calendar. The actual
 * obligation materialization is done by the worker's compliance scheduler
 * (which reads this step's output); here we just record readiness.
 */
export const activateCompliance: Flow = async (ctx): Promise<FlowResult> => {
  const company = await ctx.repo.getCompany(ctx.companyId);
  await ctx.actions.record({
    kind: "extract",
    detail: "Company fully registered — activating compliance autopilot",
  });
  return {
    output: {
      activated: true,
      hasEmployees: company.employeeCount > 0,
      vatRegistered: Boolean(company.vrn),
    },
  };
};
