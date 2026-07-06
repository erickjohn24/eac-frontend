import type { Flow, FlowResult } from "@tz/agent-core";
import { ensureTraLogin } from "./session.js";
import { waitForStatus } from "../waits.js";

/**
 * TRA — VAT registration. TRA performs a physical verification visit before
 * activation, handled here as a physical_visit action item.
 */
export const traVat: Flow = async (ctx): Promise<FlowResult> => {
  const company = await ctx.repo.getCompany(ctx.companyId);
  const { page } = ctx;
  await ensureTraLogin(ctx);

  await page.goto(`${ctx.portalUrl}/vat/apply`);
  await page.fill("input[name=tin]", company.tin ?? "");
  await page.fill("input[name=expectedTurnover]", String(company.expectedAnnualTurnoverTzs));
  await page.fill("textarea[name=businessDescription]", company.activityDescription);
  await page.click("#vat-form button[type=submit]");
  await page.waitForLoadState("networkidle");

  const appUrl = page.url();
  const appId = appUrl.split("/").pop() ?? "";

  await ctx.hitl.require({
    key: "tra.vat_visit",
    type: "physical_visit",
    title: "TRA VAT verification visit",
    instructionsMd:
      "Before activating your VAT registration, TRA visits your premises to confirm the business is genuine. We've scheduled it — ensure someone is on site with the business licence and lease. Tap \"Done\" once the officer has visited.",
    payload: {},
    expiresInMinutes: 60 * 24 * 14,
  });

  if (ctx.mode === "sandbox" && appId) {
    await page.request.post(`${ctx.portalUrl.replace(/\/tra$/, "")}/_sim/tra/vat-verify/${appId}`);
  }

  await waitForStatus(ctx, page, {
    url: appUrl,
    statusSelector: "#vat-status",
    terminal: ["registered"],
    inlineBudgetMs: 30_000,
    label: "VAT registration",
  });

  const vrn = (await page.locator("#vrn").textContent())?.trim();
  if (vrn) await ctx.repo.updateCompany(ctx.companyId, { vrn });
  return { output: { vrn } };
};
