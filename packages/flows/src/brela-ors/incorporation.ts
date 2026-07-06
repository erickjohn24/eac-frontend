import type { Flow, FlowResult } from "@tz/agent-core";
import { PortalRejection, ValidationError } from "@tz/agent-core";
import { ensureBrelaLogin } from "./session.js";
import { payControlNumber } from "../payment.js";
import { waitForStatus } from "../waits.js";

/**
 * BRELA ORS — company incorporation.
 * Files the incorporation with the reserved name, director/shareholder details,
 * and the generated Memarts + Declaration of Compliance, verifies each
 * director's TIN live against TRA, pays the registration fee, and downloads the
 * Certificate of Incorporation.
 */
export const brelaIncorporation: Flow = async (ctx, input): Promise<FlowResult> => {
  const company = await ctx.repo.getCompany(ctx.companyId);
  const people = await ctx.repo.getPeople(ctx.companyId);
  const directors = people.filter((p) => p.roles.includes("director"));
  const shareholders = people.filter((p) => p.roles.includes("shareholder"));
  const reservationNumber = input.reservationNumber as string | undefined;
  if (!reservationNumber) {
    throw new ValidationError("Incorporation requires a completed name reservation.");
  }

  const { page } = ctx;
  await ensureBrelaLogin(ctx);

  await page.goto(`${ctx.portalUrl}/incorporation`);
  await ctx.actions.record({ kind: "navigate", detail: "BRELA incorporation form" });

  await page.fill("input[name=reservationNumber]", reservationNumber);
  await page.fill("input[name=shareCapital]", String(company.shareCapitalTzs));
  await page.fill("input[name=totalShares]", String(company.totalShares));
  await page.fill("input[name=physicalAddress]", company.physicalAddress);
  await page.fill("input[name=region]", company.region);
  await page.fill("input[name=district]", company.district);

  // Verify each director's TIN live against TRA (as ORS does).
  for (const d of directors) {
    const res = await page.request.post(`${ctx.portalUrl}/verify-tin`, {
      data: { tin: d.tin ?? "", nin: d.nin ?? "" },
    });
    const body = (await res.json()) as { valid: boolean; name?: string };
    await ctx.actions.record({
      kind: "extract",
      detail: `TIN check for ${d.fullName}: ${body.valid ? "valid" : "INVALID"}`,
    });
    if (!body.valid) {
      throw new ValidationError(
        `TRA rejected the TIN for director ${d.fullName}. Correct it before incorporating.`,
      );
    }
  }

  // Fill director + shareholder repeaters.
  await fillRepeater(page, "director_fullName", directors.map((d) => d.fullName));
  await fillRepeater(page, "director_nin", directors.map((d) => d.nin ?? ""));
  await fillRepeater(page, "director_tin", directors.map((d) => d.tin ?? ""));
  await fillRepeater(page, "shareholder_fullName", shareholders.map((s) => s.fullName));
  await fillRepeater(page, "shareholder_nin", shareholders.map((s) => s.nin ?? ""));
  await fillRepeater(page, "shareholder_shares", shareholders.map((s) => String(s.sharesHeld)));

  // Upload the generated Memarts + Declaration of Compliance.
  const memartsBuf = await ctx.storage.get(await documentKey(ctx, input.memartsDocumentId as string));
  const declBuf = await ctx.storage.get(await documentKey(ctx, input.declarationDocumentId as string));
  if (memartsBuf) {
    await page.setInputFiles("input[name=memarts]", {
      name: "memarts.pdf",
      mimeType: "application/pdf",
      buffer: memartsBuf,
    });
  }
  if (declBuf) {
    await page.setInputFiles("input[name=declaration]", {
      name: "declaration.pdf",
      mimeType: "application/pdf",
      buffer: declBuf,
    });
  }
  await page.check("input[name=declarationConfirmed]");
  await ctx.actions.record({ kind: "upload", detail: "Uploaded Memarts and Declaration of Compliance" });

  await page.click("#incorporation-form button[type=submit]");
  await page.waitForLoadState("networkidle");

  const applicationUrl = page.url();
  const controlNumber = (await page.locator("#control-number").textContent())?.trim();
  if (!controlNumber) throw new Error("No GePG control number issued for incorporation");

  await payControlNumber(ctx, {
    controlNumber,
    amountTzs: 250_000,
    payee: "BRELA",
    description: `Company registration — ${company.name}`,
    stepKey: "incorporation",
  });

  const status = await waitForStatus(ctx, page, {
    url: applicationUrl,
    statusSelector: "#application-status",
    terminal: ["approved"],
    rejected: ["queried"],
    inlineBudgetMs: 45_000,
    label: "Incorporation review",
  });
  if (status === "queried") {
    throw new PortalRejection("BRELA queried the incorporation application; manual review needed.");
  }

  const incorporationNumber = (await page.locator("#incorporation-number").textContent())?.trim();
  const incorporationDateText = (await page.locator("#incorporation-date").textContent())?.trim();

  // Download and store the Certificate of Incorporation.
  const certUrl = await page.locator("#certificate-download").getAttribute("href");
  if (certUrl) {
    const abs = certUrl.startsWith("http") ? certUrl : `${new URL(applicationUrl).origin}${certUrl}`;
    const dl = await page.request.get(abs);
    const buf = Buffer.from(await dl.body());
    await ctx.repo.addDocument({
      companyId: ctx.companyId,
      stepRunId: ctx.stepRunId,
      kind: "incorporation_certificate",
      title: `Certificate of Incorporation — ${company.name}`,
      data: buf,
      source: "scraped_from_portal",
    });
    await ctx.actions.record({ kind: "download", detail: "Downloaded Certificate of Incorporation" });
  }

  await ctx.repo.updateCompany(ctx.companyId, {
    incorporationNumber: incorporationNumber ?? null,
    incorporationDate: incorporationDateText ? new Date(incorporationDateText) : new Date(),
    nameStatus: "registered",
  });

  return {
    output: {
      incorporationNumber,
      incorporationDate: incorporationDateText,
      controlNumber,
    },
  };
};

async function fillRepeater(
  page: import("playwright").Page,
  name: string,
  values: string[],
): Promise<void> {
  const inputs = page.locator(`[name="${name}[]"]`);
  const count = await inputs.count();
  for (let i = 0; i < values.length && i < count; i++) {
    await inputs.nth(i).fill(values[i] ?? "");
  }
}

/** The storage key for a previously-generated document id. Flows receive
 *  document ids in their input; the repo stores them under a stable key. */
async function documentKey(ctx: import("@tz/agent-core").FlowContext, documentId: string): Promise<string> {
  // Documents are stored at documents/<companyId>/<documentId>.pdf by the repo.
  return `documents/${ctx.companyId}/${documentId}.pdf`;
}
