import Anthropic from "@anthropic-ai/sdk";
import type { Page } from "playwright";
import type { AiAction, AiLayer } from "./types.js";

/**
 * Hybrid AI layer (tier 2 self-healing). Deterministic Playwright is always
 * the primary path in the flows; the AI layer is only called when a selector
 * is missing or ambiguous. It reads the accessibility tree (token-efficient,
 * auditable) rather than screenshots for tier 2.
 *
 * Model routing:
 *  - navigation / extraction: claude-haiku-4-5 (cheap, fast)
 *  - (recovery / computer-use vision fallback lives in tier 3, added later)
 *
 * Without ANTHROPIC_API_KEY the layer is disabled: `enabled=false` and callers
 * fall back to failing the step (sandbox flows never need tier 2 because the
 * simulator matches the deterministic selectors exactly).
 */

const NAV_MODEL = "claude-haiku-4-5";

export class ClaudeAiLayer implements AiLayer {
  readonly enabled: boolean;
  private client: Anthropic | null;

  constructor(apiKey = process.env.ANTHROPIC_API_KEY) {
    this.enabled = Boolean(apiKey);
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
  }

  private async a11ySnapshot(page: Page): Promise<string> {
    // ARIA snapshot: token-efficient, structured, and auditable.
    const tree = await page.locator("body").ariaSnapshot();
    return tree.slice(0, 12_000);
  }

  async act(page: Page, instruction: string, flowStep: string): Promise<AiAction> {
    if (!this.client) {
      return { op: "none", selector: "", reasoning: "AI layer disabled (no API key)" };
    }
    const snapshot = await this.a11ySnapshot(page);
    const system = [
      "You are a browser automation assistant driving a Tanzanian government portal.",
      "Given an accessibility-tree snapshot and an instruction, return the single",
      "best next action as JSON. Prefer stable CSS selectors (id, name attribute).",
      `Flow step: ${flowStep}.`,
    ].join(" ");
    const msg = await this.client.messages.create({
      model: NAV_MODEL,
      max_tokens: 512,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content:
            `Instruction: ${instruction}\n\nAccessibility tree:\n${snapshot}\n\n` +
            `Respond ONLY with JSON: {"op":"click|fill|select|none","selector":"...","value":"...","reasoning":"..."}`,
        },
      ],
    });
    const text = msg.content.find((c) => c.type === "text");
    if (!text || text.type !== "text") {
      return { op: "none", selector: "", reasoning: "no response" };
    }
    try {
      const json = text.text.slice(text.text.indexOf("{"), text.text.lastIndexOf("}") + 1);
      return JSON.parse(json) as AiAction;
    } catch {
      return { op: "none", selector: "", reasoning: "unparseable response" };
    }
  }

  async extract<T>(page: Page, instruction: string, exampleJson: string): Promise<T | null> {
    if (!this.client) return null;
    const snapshot = await this.a11ySnapshot(page);
    const msg = await this.client.messages.create({
      model: NAV_MODEL,
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content:
            `Extract data from this page. ${instruction}\n\nReturn JSON matching this shape:\n${exampleJson}\n\n` +
            `Page:\n${snapshot}`,
        },
      ],
    });
    const text = msg.content.find((c) => c.type === "text");
    if (!text || text.type !== "text") return null;
    try {
      const json = text.text.slice(text.text.indexOf("{"), text.text.lastIndexOf("}") + 1);
      return JSON.parse(json) as T;
    } catch {
      return null;
    }
  }
}

/** Null layer used when AI is explicitly disabled. */
export const disabledAiLayer: AiLayer = {
  enabled: false,
  async act() {
    return { op: "none", selector: "", reasoning: "disabled" };
  },
  async extract() {
    return null;
  },
};
