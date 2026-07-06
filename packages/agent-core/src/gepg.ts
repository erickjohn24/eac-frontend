/**
 * GePG (Government Electronic Payment Gateway) client.
 *
 * GePG is the one government system with a real integration API. In sandbox
 * mode we talk to the simulator's /gepg endpoints. The interface is the same
 * shape a real GePG PSP integration would expose: look up a bill by control
 * number, and (for the customer) trigger a mobile-money payment.
 */

export interface GepgBill {
  controlNumber: string;
  amountTzs: number;
  payee: string;
  description: string;
  status: "pending" | "paid";
  receiptNo?: string;
}

export class GepgClient {
  constructor(private readonly gepgUrl: string) {}

  async getBill(controlNumber: string): Promise<GepgBill | null> {
    const res = await fetch(`${this.gepgUrl}/_sim/gepg/bills/${controlNumber}`);
    if (!res.ok) return null;
    return (await res.json()) as GepgBill;
  }

  /**
   * Simulate the customer paying the control number on their handset.
   * In live mode this is NOT called by the agent — the customer pays via
   * M-Pesa/Tigo/Airtel and we detect it by polling getBill(). Here it lets
   * the HITL "payment_authorization" resolution actually settle the bill.
   */
  async simulatePay(
    controlNumber: string,
    method: string,
  ): Promise<{ status: string; receiptNo: string } | null> {
    const res = await fetch(`${this.gepgUrl}/_sim/gepg/pay/${controlNumber}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ method }),
    });
    if (!res.ok) return null;
    return (await res.json()) as { status: string; receiptNo: string };
  }

  async waitForPayment(controlNumber: string, timeoutMs = 30_000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const bill = await this.getBill(controlNumber);
      if (bill?.status === "paid") return true;
      await new Promise((r) => setTimeout(r, 500));
    }
    return false;
  }
}
