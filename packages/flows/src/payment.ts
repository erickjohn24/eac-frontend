import type { FlowContext } from "@tz/agent-core";
import { formatTzs, type Payee } from "@tz/shared";

/**
 * Handle a GePG control-number payment as a human-in-the-loop step.
 * The portal has issued a control number; the customer pays it on their phone
 * (M-Pesa/Tigo/Airtel). We record the Payment, raise a payment_authorization
 * action item, and — once the customer confirms — settle the bill (sandbox) and
 * wait for the portal to register the payment.
 */
export async function payControlNumber(
  ctx: FlowContext,
  args: {
    controlNumber: string;
    amountTzs: number;
    payee: Payee;
    description: string;
    stepKey: string;
  },
): Promise<void> {
  await ctx.repo.createPayment({
    companyId: ctx.companyId,
    stepRunId: ctx.stepRunId,
    gepgControlNumber: args.controlNumber,
    description: args.description,
    amountTzs: args.amountTzs,
    payee: args.payee,
  });

  await ctx.actions.record({
    kind: "extract",
    detail: `GePG control number ${args.controlNumber} issued for ${formatTzs(args.amountTzs)} to ${args.payee}`,
  });

  const resolution = await ctx.hitl.require({
    key: `pay.${args.stepKey}`,
    type: "payment_authorization",
    title: `Pay ${formatTzs(args.amountTzs)} to ${args.payee}`,
    instructionsMd:
      `A government fee is ready to pay via GePG.\n\n` +
      `**Control number:** \`${args.controlNumber}\`\n\n` +
      `**Amount:** ${formatTzs(args.amountTzs)}\n\n` +
      `Pay from your phone: dial your mobile-money menu (M-Pesa, Mixx by Yas, Airtel Money or HaloPesa), ` +
      `choose *Pay Bill / Government (GePG)*, enter the control number above, and approve with your PIN. ` +
      `Then tap "I've paid" below.`,
    payload: {
      controlNumber: args.controlNumber,
      amountTzs: args.amountTzs,
      payee: args.payee,
    },
    expiresInMinutes: 60,
  });

  // In sandbox, settle the bill to reflect the customer's payment.
  const method = (resolution.method as string) ?? "mpesa";
  if (ctx.mode === "sandbox") {
    await ctx.gepg.simulatePay(args.controlNumber, method);
  }
  await ctx.repo.markPaymentPaid(args.controlNumber, method);

  await ctx.actions.record({
    kind: "extract",
    detail: `Payment confirmed for control number ${args.controlNumber} via ${method}`,
  });

  // Wait for GePG to mark the bill paid (real-time in sandbox).
  await ctx.gepg.waitForPayment(args.controlNumber, 15_000);
}
