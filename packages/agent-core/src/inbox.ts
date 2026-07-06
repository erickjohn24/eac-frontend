import type { InboxClient, SimMessage } from "./types.js";

/**
 * Virtual inbox client for sandbox mode. Reads OTPs and activation links that
 * the simulator "sent" to the customer. In live mode this is replaced by a
 * real relay: the OTP arrives on the customer's actual phone and is surfaced
 * to them as a HITL action item instead of being read here.
 */
export class SimulatorInbox implements InboxClient {
  constructor(private readonly simulatorUrl: string) {}

  async list(to: string): Promise<SimMessage[]> {
    const res = await fetch(
      `${this.simulatorUrl}/_sim/messages?to=${encodeURIComponent(to)}`,
    );
    if (!res.ok) return [];
    return (await res.json()) as SimMessage[];
  }

  async waitFor(
    to: string,
    predicate: (m: SimMessage) => boolean,
    timeoutMs = 20_000,
  ): Promise<SimMessage | null> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const messages = await this.list(to);
      const match = messages.find(predicate);
      if (match) return match;
      await new Promise((r) => setTimeout(r, 500));
    }
    return null;
  }
}

/** Extract a 6-digit OTP from message text. */
export function extractOtp(body: string): string | null {
  const m = body.match(/\b(\d{6})\b/);
  return m ? m[1]! : null;
}

/** Extract the first URL/path from message text. */
export function extractLink(body: string): string | null {
  const m = body.match(/(https?:\/\/\S+|\/[^\s"']+)/);
  return m ? m[1]! : null;
}
