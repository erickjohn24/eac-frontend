import type { Flow, FlowResult } from "@tz/agent-core";
import { PortalRejection } from "@tz/agent-core";
import { ensureBrelaLogin } from "./session.js";
import { payControlNumber } from "../payment.js";
import { waitForStatus } from "../waits.js";

/**
 * BRELA ORS — company name search & reservation.
 * Searches for availability, reserves the name, pays the GePG fee, and waits
 * for the reservation to be confirmed.
 */
export const brelaNameReservation: Flow = async (ctx): Promise<FlowResult> => {
  const company = await ctx.repo.getCompany(ctx.companyId);
  const { page } = ctx;

  await ensureBrelaLogin(ctx);

  // Public availability search across the primary + alternative names.
  const candidates = [company.name, ...company.alternativeNames];
  let chosen: string | null = null;
  for (const name of candidates) {
    await page.goto(`${ctx.portalUrl}/name-search?q=${encodeURIComponent(name)}`);
    const status = await page.locator("#search-result").getAttribute("data-status");
    await ctx.actions.record({ kind: "extract", detail: `Name "${name}" is ${status}` });
    if (status === "available") {
      chosen = name;
      break;
    }
  }
  if (!chosen) {
    throw new PortalRejection(
      `None of the proposed names are available: ${candidates.join(", ")}. Please choose another.`,
    );
  }

  // Reserve the chosen name.
  await page.goto(`${ctx.portalUrl}/name-reservation`);
  await page.fill("input[name=proposedName]", chosen);
  await page.selectOption("select[name=entityType]", "private_company");
  await page.fill("textarea[name=natureOfBusiness]", company.activityDescription);
  await page.click("#reservation-form button[type=submit]");
  await page.waitForLoadState("networkidle");
  await ctx.actions.record({ kind: "click", detail: `Submitted reservation for "${chosen}"` });

  const reservationUrl = page.url();
  const controlNumber = (await page.locator("#control-number").textContent())?.trim();
  if (!controlNumber) throw new Error("No GePG control number issued for name reservation");

  await payControlNumber(ctx, {
    controlNumber,
    amountTzs: 50_000,
    payee: "BRELA",
    description: `Name reservation — ${chosen}`,
    stepKey: "name_reservation",
  });

  const status = await waitForStatus(ctx, page, {
    url: reservationUrl,
    statusSelector: "#reservation-status",
    terminal: ["reserved"],
    rejected: ["rejected"],
    label: "Name reservation",
  });
  if (status === "rejected") {
    throw new PortalRejection(`BRELA rejected the name reservation for "${chosen}".`);
  }

  const reservationNumber = (await page.locator("#reservation-number").textContent())?.trim();
  await ctx.repo.updateCompany(ctx.companyId, { name: chosen, nameStatus: "reserved" });

  // Persist the reservation certificate if the portal offers one.
  await ctx.actions.record({ kind: "extract", detail: `Name reserved: ${reservationNumber}` });

  return {
    output: {
      reservedName: chosen,
      reservationNumber,
      controlNumber,
    },
  };
};
