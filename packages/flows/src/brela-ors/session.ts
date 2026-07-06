import type { FlowContext } from "@tz/agent-core";
import { extractLink } from "@tz/agent-core";

/**
 * Ensure a BRELA ORS account exists and the browser is logged in.
 * Idempotent across retries: tries to log in first; if that fails, registers a
 * new account (solving the arithmetic CAPTCHA via a human handoff) and
 * activates it through the virtual inbox.
 */
export async function ensureBrelaLogin(ctx: FlowContext): Promise<{ email: string }> {
  const company = await ctx.repo.getCompany(ctx.companyId);
  const people = await ctx.repo.getPeople(ctx.companyId);
  const primary = people.find((p) => p.roles.includes("director")) ?? people[0];
  if (!primary) throw new Error("No director on file to own the BRELA account");

  // deterministic per-company credentials stored in the vault
  const existing = await ctx.vault.get(ctx.companyId, "brela_ors");
  const email = existing?.username ?? `${company.id.slice(0, 8)}@applicant.tzcompliance.dev`;
  const password = existing?.secret ?? `Tz!${company.id.slice(0, 10)}`;
  if (!existing) await ctx.vault.set(ctx.companyId, "brela_ors", email, password);

  const { page } = ctx;

  // Try login first (handles retry after a mid-flow failure).
  await page.goto(`${ctx.portalUrl}/login`);
  await ctx.actions.record({ kind: "navigate", detail: "BRELA ORS login page" });
  await page.fill("input[name=email]", email);
  await page.fill("input[name=password]", password);
  await page.click("#login-form button[type=submit]");
  await page.waitForLoadState("networkidle");
  if (await page.locator("nav .user-email").count()) {
    await ctx.actions.record({ kind: "extract", detail: "Logged in to existing BRELA account" });
    return { email };
  }

  // Register a new account.
  await page.goto(`${ctx.portalUrl}/register`);
  await ctx.actions.record({ kind: "navigate", detail: "BRELA ORS account registration" });

  const nin = primary.nin ?? "12345678901234567890";
  await page.fill("input[name=nin]", nin);
  await page.click("#load-nida");
  await page.waitForLoadState("networkidle");
  await ctx.actions.record({ kind: "extract", detail: "Loaded identity from NIDA", valueRedacted: nin.slice(0, 4) + "…" });

  await page.fill("input[name=email]", email);
  await page.fill("input[name=phone]", primary.phone ?? "+255700000000");
  await page.fill("input[name=password]", password);

  // CAPTCHA: hand off to a human. Capture the screenshot for the action item.
  const captchaPrompt = (await page.locator("#captcha-question").textContent())?.trim() ?? "";
  const shotKey = await ctx.actions.screenshot("brela-captcha");
  await ctx.actions.record({ kind: "captcha_wait", detail: `CAPTCHA presented: ${captchaPrompt}` });

  const resolution = await ctx.hitl.require({
    key: "brela.captcha",
    type: "captcha_handoff",
    title: "Solve the BRELA security check",
    instructionsMd:
      `BRELA's account signup shows a quick security question. Please read it from the screenshot and enter the answer so our agent can continue.\n\n**${captchaPrompt}**`,
    payload: { screenshotKey: shotKey, captchaPrompt },
    expiresInMinutes: 30,
  });

  await page.fill("input[name=captcha]", String(resolution.code ?? ""));
  await page.click("#register-form button[type=submit]");
  await page.waitForLoadState("networkidle");

  if (await page.locator(".error-banner").count()) {
    const err = await page.locator(".error-banner").first().textContent();
    throw new Error(`BRELA registration failed: ${err?.trim()}`);
  }

  // Activate via the virtual inbox (the activation email the portal "sent").
  await ctx.actions.record({ kind: "otp_wait", detail: "Waiting for BRELA activation email" });
  const msg = await ctx.inbox.waitFor(email, (m) => /activat/i.test(m.subject) || /activate/i.test(m.body));
  if (!msg) throw new Error("BRELA activation email did not arrive");
  const link = extractLink(msg.body);
  if (!link) throw new Error("No activation link in BRELA email");
  const activateUrl = link.startsWith("http") ? link : `${ctx.portalUrl.replace(/\/brela-ors$/, "")}${link}`;
  await page.goto(activateUrl);
  await ctx.actions.record({ kind: "navigate", detail: "Activated BRELA account via email link" });

  // Log in with the now-active account.
  await page.goto(`${ctx.portalUrl}/login`);
  await page.fill("input[name=email]", email);
  await page.fill("input[name=password]", password);
  await page.click("#login-form button[type=submit]");
  await page.waitForLoadState("networkidle");

  return { email };
}
