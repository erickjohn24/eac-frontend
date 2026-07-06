import type { FlowContext } from "@tz/agent-core";
import { GovtWait } from "@tz/agent-core";
import type { Page } from "playwright";

/**
 * Poll a portal status page until its `data-status` on `statusSelector` reaches
 * one of `terminal`, or throw GovtWait to reschedule if it takes longer than
 * the inline budget. In sandbox, government delays are seconds, so this resolves
 * inline; in live mode a long delay reschedules the step instead of blocking.
 */
export async function waitForStatus(
  ctx: FlowContext,
  page: Page,
  opts: {
    url: string;
    statusSelector: string;
    terminal: string[];
    rejected?: string[];
    inlineBudgetMs?: number;
    pollMs?: number;
    label: string;
  },
): Promise<string> {
  const budget = opts.inlineBudgetMs ?? 30_000;
  const pollMs = opts.pollMs ?? 1500;
  const deadline = Date.now() + budget;

  while (Date.now() < deadline) {
    await page.goto(opts.url);
    const status =
      (await page.locator(opts.statusSelector).getAttribute("data-status")) ?? "unknown";
    await ctx.actions.record({
      kind: "extract",
      detail: `${opts.label}: status=${status}`,
    });
    if (opts.terminal.includes(status)) return status;
    if (opts.rejected?.includes(status)) {
      return status;
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new GovtWait(60_000, `${opts.label} still processing`);
}
