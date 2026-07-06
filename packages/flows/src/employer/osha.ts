import type { Flow, FlowResult } from "@tz/agent-core";
import { waitForStatus } from "../waits.js";

/** OSHA workplace registration — includes a physical inspection gate. */
export const oshaRegister: Flow = async (ctx): Promise<FlowResult> => {
  const company = await ctx.repo.getCompany(ctx.companyId);
  const { page } = ctx;

  await page.goto(`${ctx.portalUrl}/workplace/register`);
  await page.fill("input[name=tin]", company.tin ?? "");
  await page.fill("input[name=companyName]", company.name);
  await page.fill("input[name=workplaceAddress]", company.physicalAddress);
  await page.fill("input[name=employeeCount]", String(company.employeeCount));
  await page.selectOption("select[name=riskCategory]", "low").catch(() => {});
  await page.click("#osha-form button[type=submit]");
  await page.waitForLoadState("networkidle");
  const appUrl = page.url();

  const inspectionRef = (await page.locator("#inspection-ref").textContent())?.trim();
  await ctx.hitl.require({
    key: "osha.inspection",
    type: "physical_visit",
    title: "OSHA workplace inspection",
    instructionsMd:
      `OSHA inspects your workplace before issuing the compliance licence.\n\n**Inspection reference:** \`${inspectionRef ?? "—"}\`\n\nEnsure the premises meet basic occupational safety requirements (first aid, fire extinguishers, clear exits). Tap "Done" once inspected.`,
    payload: { appointmentRef: inspectionRef },
    expiresInMinutes: 60 * 24 * 14,
  });

  if (ctx.mode === "sandbox" && inspectionRef) {
    await page.request.post(`${ctx.portalUrl.replace(/\/osha$/, "")}/_sim/osha/inspect/${inspectionRef}`);
  }

  await waitForStatus(ctx, page, {
    url: appUrl,
    statusSelector: "#osha-status",
    terminal: ["registered"],
    inlineBudgetMs: 30_000,
    label: "OSHA registration",
  });

  const oshaNumber = (await page.locator("#osha-number").textContent())?.trim();
  const certUrl = await page.locator("#osha-certificate").getAttribute("href").catch(() => null);
  if (certUrl) {
    const abs = certUrl.startsWith("http") ? certUrl : `${new URL(appUrl).origin}${certUrl}`;
    const dl = await page.request.get(abs);
    const oneYear = new Date();
    oneYear.setFullYear(oneYear.getFullYear() + 1);
    await ctx.repo.addDocument({
      companyId: ctx.companyId,
      stepRunId: ctx.stepRunId,
      kind: "osha_certificate",
      title: `OSHA Compliance Licence — ${company.name}`,
      data: Buffer.from(await dl.body()),
      source: "scraped_from_portal",
      expiresAt: oneYear,
    });
  }
  return { output: { oshaNumber, inspectionRef } };
};
