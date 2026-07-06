import type { Flow, FlowResult } from "@tz/agent-core";
import { waitForStatus } from "../waits.js";

/** WCF employer registration. */
export const wcfRegister: Flow = async (ctx): Promise<FlowResult> => {
  const company = await ctx.repo.getCompany(ctx.companyId);
  const { page } = ctx;

  await page.goto(`${ctx.portalUrl}/employer/register`);
  await page.fill("input[name=tin]", company.tin ?? "");
  await page.fill("input[name=companyName]", company.name);
  await page.fill("input[name=incorporationNumber]", company.incorporationNumber ?? "");
  await page.fill("input[name=employeeCount]", String(company.employeeCount));
  await page.fill("input[name=contactEmail]", "hr@company.co.tz");
  await page.click("#wcf-form button[type=submit]");
  await page.waitForLoadState("networkidle");
  const appUrl = page.url();

  await waitForStatus(ctx, page, {
    url: appUrl,
    statusSelector: "#wcf-status",
    terminal: ["registered"],
    inlineBudgetMs: 30_000,
    label: "WCF registration",
  });

  const wcfNumber = (await page.locator("#wcf-number").textContent())?.trim();
  const certUrl = await page.locator("#wcf-certificate").getAttribute("href").catch(() => null);
  if (certUrl) {
    const abs = certUrl.startsWith("http") ? certUrl : `${new URL(appUrl).origin}${certUrl}`;
    const dl = await page.request.get(abs);
    await ctx.repo.addDocument({
      companyId: ctx.companyId,
      stepRunId: ctx.stepRunId,
      kind: "wcf_certificate",
      title: `WCF Registration — ${company.name}`,
      data: Buffer.from(await dl.body()),
      source: "scraped_from_portal",
    });
  }
  return { output: { wcfNumber } };
};
