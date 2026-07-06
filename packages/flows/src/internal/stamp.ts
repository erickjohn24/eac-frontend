import type { Flow, FlowResult } from "@tz/agent-core";
import { STAMP_VENDORS } from "@tz/shared";

/**
 * Company stamp — a fulfillment step. Places an order with a vetted Dar es
 * Salaam vendor and tracks delivery. In sandbox the order is auto-progressed.
 */
export const orderStamp: Flow = async (ctx): Promise<FlowResult> => {
  const vendor = STAMP_VENDORS[0];
  const order = await ctx.repo.createFulfillmentOrder({
    companyId: ctx.companyId,
    stepRunId: ctx.stepRunId,
    kind: "company_stamp",
    vendorId: vendor.id,
    vendorName: vendor.name,
    priceTzs: vendor.priceTzs,
  });

  await ctx.actions.record({
    kind: "extract",
    detail: `Ordered company stamp from ${vendor.name} (${vendor.location})`,
  });

  return {
    output: {
      fulfillmentOrderId: order.id,
      vendor: vendor.name,
      etaDays: vendor.etaDays,
    },
  };
};
