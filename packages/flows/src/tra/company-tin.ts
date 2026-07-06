import type { Flow, FlowResult } from "@tz/agent-core";
import { ensureTraLogin } from "./session.js";
import { waitForStatus } from "../waits.js";

/**
 * TRA — company TIN registration. Files the application, then handles the
 * mandatory one-time biometric visit as a physical_visit action item before
 * the TIN is issued.
 */
export const traCompanyTin: Flow = async (ctx): Promise<FlowResult> => {
  const company = await ctx.repo.getCompany(ctx.companyId);
  const people = await ctx.repo.getPeople(ctx.companyId);
  const rep = people.find((p) => p.roles.includes("director")) ?? people[0];
  const { page } = ctx;

  await ensureTraLogin(ctx);

  await page.goto(`${ctx.portalUrl}/tin/company`);
  await page.fill("input[name=incorporationNumber]", company.incorporationNumber ?? "");
  await page.fill("input[name=companyName]", company.name);
  await page.fill("input[name=physicalAddress]", company.physicalAddress);
  await page.fill("input[name=region]", company.region);
  const sector = company.businessActivityIsic[0] ?? "6201";
  await page.selectOption("select[name=businessSector]", sector).catch(() => {});
  await page.fill("input[name=repFullName]", rep?.fullName ?? "");
  await page.fill("input[name=repNin]", rep?.nin ?? "");
  await page.fill("input[name=repTin]", rep?.tin ?? "");
  await page.click("#company-tin-form button[type=submit]");
  await page.waitForLoadState("networkidle");
  await ctx.actions.record({ kind: "click", detail: "Submitted company TIN application" });

  const appUrl = page.url();
  const appointmentRef = (await page.locator("#appointment-ref").textContent())?.trim();
  const location = (await page.locator("#appointment-location").textContent())?.trim();

  // Biometric visit — cannot be automated; guide the customer.
  await ctx.hitl.require({
    key: "tra.biometrics",
    type: "physical_visit",
    title: "Complete TRA biometrics",
    instructionsMd:
      `TRA requires a one-time biometric capture (photo, fingerprints and signature) for a company director before your TIN is issued.\n\n` +
      `**Appointment reference:** \`${appointmentRef ?? "—"}\`\n\n` +
      `**Location:** ${location ?? "your nearest TRA office"}\n\n` +
      `Bring the director's National ID and the Certificate of Incorporation. Tap "Done" once the visit is complete.`,
    payload: { appointmentRef, appointmentLocation: location },
    expiresInMinutes: 60 * 24 * 14,
  });

  // Mark biometrics complete (sandbox) so the TIN can be issued.
  if (ctx.mode === "sandbox" && appointmentRef) {
    await page.request.post(`${ctx.portalUrl.replace(/\/tra$/, "")}/_sim/tra/biometrics/${appointmentRef}`);
  }

  const status = await waitForStatus(ctx, page, {
    url: appUrl,
    statusSelector: "#tin-status",
    terminal: ["issued"],
    inlineBudgetMs: 30_000,
    label: "TIN issuance",
  });

  const tin = (await page.locator("#company-tin").textContent())?.trim();
  const certUrl = await page.locator("#tin-certificate").getAttribute("href").catch(() => null);
  if (certUrl) {
    const abs = certUrl.startsWith("http") ? certUrl : `${new URL(appUrl).origin}${certUrl}`;
    const dl = await page.request.get(abs);
    await ctx.repo.addDocument({
      companyId: ctx.companyId,
      stepRunId: ctx.stepRunId,
      kind: "tin_certificate",
      title: `TIN Certificate — ${company.name}`,
      data: Buffer.from(await dl.body()),
      source: "scraped_from_portal",
    });
  }

  if (tin) await ctx.repo.updateCompany(ctx.companyId, { tin });

  return { output: { tin, appointmentRef, status } };
};
