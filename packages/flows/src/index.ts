import type { Flow } from "@tz/agent-core";
import { kycDirectors } from "./internal/kyc.js";
import { generateMemarts } from "./internal/memarts.js";
import { activateCompliance } from "./internal/compliance-activate.js";
import { bankAccountConcierge } from "./internal/bank.js";
import { orderStamp } from "./internal/stamp.js";
import { brelaNameReservation } from "./brela-ors/name-reservation.js";
import { brelaIncorporation } from "./brela-ors/incorporation.js";
import { traCompanyTin } from "./tra/company-tin.js";
import { traVat } from "./tra/vat.js";
import { licenceApplication } from "./licence/apply.js";
import { nssfRegister } from "./employer/nssf.js";
import { wcfRegister } from "./employer/wcf.js";
import { oshaRegister } from "./employer/osha.js";

/** Maps each pipeline step id to the flow that executes it. */
export const FLOW_REGISTRY: Record<string, Flow> = {
  "kyc.directors": kycDirectors,
  "brela.name_reservation": brelaNameReservation,
  "docs.memarts": generateMemarts,
  "brela.incorporation": brelaIncorporation,
  "tra.company_tin": traCompanyTin,
  "licence.application": licenceApplication,
  "tra.vat": traVat,
  "nssf.register": nssfRegister,
  "wcf.register": wcfRegister,
  "osha.register": oshaRegister,
  "bank.account": bankAccountConcierge,
  "stamp.order": orderStamp,
  "compliance.activate": activateCompliance,
};

/** Steps whose kind requires a browser session (portal automation). */
export const PORTAL_STEPS = new Set([
  "brela.name_reservation",
  "brela.incorporation",
  "tra.company_tin",
  "tra.vat",
  "licence.application",
  "nssf.register",
  "wcf.register",
  "osha.register",
]);

export function getFlow(stepId: string): Flow {
  const flow = FLOW_REGISTRY[stepId];
  if (!flow) throw new Error(`No flow registered for step ${stepId}`);
  return flow;
}

export * from "./pdf.js";
