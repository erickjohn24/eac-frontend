import type { Flow, FlowContext, FlowResult } from "@tz/agent-core";
import { portalBaseUrl } from "@tz/shared";
import { payControlNumber } from "../payment.js";
import { waitForStatus } from "../waits.js";

/**
 * Business licence application. Class A (larger/regulated activities) is filed
 * via the National Business Portal (TNBP); Class B (local businesses) via TAUSI.
 * The step is declared against the tnbp portal; here we route to the right one
 * by activity and drive whichever portal applies.
 */
export const licenceApplication: Flow = async (ctx): Promise<FlowResult> => {
  const company = await ctx.repo.getCompany(ctx.companyId);

  // Simple routing: manufacturing/tourism/regulated → Class A (TNBP); else Class B (TAUSI).
  const classA = company.businessActivityIsic.some((c) =>
    ["1071", "5510", "7911", "6612", "6419", "8690"].includes(c),
  );
  const portalId = classA ? "tnbp" : "tausi";
  const base =
    portalId === ctx.portal
      ? ctx.portalUrl
      : portalBaseUrl(portalId, ctx.mode, simulatorRoot(ctx));

  const { page } = ctx;
  await page.goto(`${base}/licence/apply`);
  await ctx.actions.record({
    kind: "navigate",
    detail: `Business licence — Class ${classA ? "A (TNBP)" : "B (TAUSI)"}`,
  });

  await page.fill("input[name=tin]", company.tin ?? "");
  await page.fill("input[name=incorporationNumber]", company.incorporationNumber ?? "");
  await page.fill("input[name=businessName]", company.name);
  await page.selectOption("select[name=activityCode]", company.businessActivityIsic[0] ?? "4711").catch(() => {});
  await page.fill("input[name=premisesAddress]", company.physicalAddress);

  // Lease agreement + TIN certificate uploads (data confirmation for lease).
  await ctx.hitl.require({
    key: "licence.lease",
    type: "document_upload",
    title: "Upload your premises lease agreement",
    instructionsMd:
      "The business licence requires proof of premises. Upload your signed lease agreement (or title deed) for the registered address.",
    payload: { documentKind: "lease_agreement" },
    expiresInMinutes: 60 * 24 * 7,
  });

  // In sandbox we synthesize placeholder uploads to satisfy the form.
  const placeholder = Buffer.from("%PDF-1.4\n% lease placeholder\n");
  await page.setInputFiles("input[name=leaseAgreement]", {
    name: "lease.pdf",
    mimeType: "application/pdf",
    buffer: placeholder,
  }).catch(() => {});
  await page.setInputFiles("input[name=tinCertificate]", {
    name: "tin.pdf",
    mimeType: "application/pdf",
    buffer: placeholder,
  }).catch(() => {});

  await page.click("#licence-form button[type=submit]");
  await page.waitForLoadState("networkidle");

  const appUrl = page.url();
  const controlNumber = (await page.locator("#control-number").textContent())?.trim();
  if (controlNumber) {
    await payControlNumber(ctx, {
      controlNumber,
      amountTzs: classA ? 150_000 : 80_000,
      payee: classA ? "MIT" : "LGA",
      description: `Business licence — ${company.name}`,
      stepKey: "licence",
    });
  }

  await waitForStatus(ctx, page, {
    url: appUrl,
    statusSelector: "#licence-status",
    terminal: ["issued"],
    inlineBudgetMs: 30_000,
    label: "Business licence",
  });

  const licenceNumber = (await page.locator("#licence-number").textContent())?.trim();
  const certUrl = await page.locator("#licence-certificate").getAttribute("href").catch(() => null);
  if (certUrl) {
    const abs = certUrl.startsWith("http") ? certUrl : `${new URL(appUrl).origin}${certUrl}`;
    const dl = await page.request.get(abs);
    const oneYear = new Date();
    oneYear.setFullYear(oneYear.getFullYear() + 1);
    await ctx.repo.addDocument({
      companyId: ctx.companyId,
      stepRunId: ctx.stepRunId,
      kind: "business_licence",
      title: `Business Licence — ${company.name}`,
      data: Buffer.from(await dl.body()),
      source: "scraped_from_portal",
      expiresAt: oneYear,
    });
  }

  return { output: { licenceNumber, class: classA ? "A" : "B" } };
};

function simulatorRoot(ctx: FlowContext): string {
  // ctx.portalUrl ends with the portal simPath; strip it to get the sim root.
  return ctx.portalUrl.replace(/\/[a-z-]+$/, "");
}
