import type { FlowContext } from "@tz/agent-core";
import { extractOtp } from "@tz/agent-core";

/**
 * Ensure a TRA Taxpayer Portal account exists and is logged in.
 * TRA sends a 6-digit OTP by email at signup; the customer's OTP is relayed
 * here (sandbox: read from the virtual inbox; live: a HITL otp_entry item).
 */
export async function ensureTraLogin(ctx: FlowContext): Promise<{ email: string }> {
  const company = await ctx.repo.getCompany(ctx.companyId);
  const people = await ctx.repo.getPeople(ctx.companyId);
  const primary = people.find((p) => p.roles.includes("director")) ?? people[0];

  const existing = await ctx.vault.get(ctx.companyId, "tra");
  const email = existing?.username ?? `${company.id.slice(0, 8)}@tra.tzcompliance.dev`;
  const password = existing?.secret ?? `Tra!${company.id.slice(0, 10)}`;
  if (!existing) await ctx.vault.set(ctx.companyId, "tra", email, password);

  const { page } = ctx;
  await page.goto(`${ctx.portalUrl}/login`);
  await page.fill("input[name=email]", email);
  await page.fill("input[name=password]", password);
  await page.click("#login-form button[type=submit]");
  await page.waitForLoadState("networkidle");
  if (!(await page.locator(".error-banner").count())) {
    if (await page.locator("nav .user-email").count()) return { email };
  }

  // Register.
  await page.goto(`${ctx.portalUrl}/register`);
  await page.fill("input[name=email]", email);
  await page.fill("input[name=phone]", primary?.phone ?? "+255700000000");
  await page.fill("input[name=password]", password);
  await page.click("#tra-register-form button[type=submit]");
  await page.waitForLoadState("networkidle");
  await ctx.actions.record({ kind: "otp_wait", detail: "Waiting for TRA verification code" });

  // Relay the OTP.
  let code: string | null = null;
  if (ctx.mode === "sandbox") {
    const msg = await ctx.inbox.waitFor(email, (m) => /TRA/i.test(m.subject));
    code = msg ? extractOtp(msg.body) : null;
  }
  if (!code) {
    const resolution = await ctx.hitl.require({
      key: "tra.otp",
      type: "otp_entry",
      title: "Enter the TRA verification code",
      instructionsMd:
        "TRA just sent a 6-digit verification code to the phone/email on record. Enter it below so our agent can finish creating your tax account. It expires in 15 minutes.",
      payload: { otpDestination: primary?.phone ?? email },
      expiresInMinutes: 15,
    });
    code = String(resolution.code ?? "");
  }

  await page.fill("input[name=otp]", code);
  await page.click("#otp-form button[type=submit]");
  await page.waitForLoadState("networkidle");
  if (await page.locator(".error-banner").count()) {
    throw new Error("TRA rejected the verification code");
  }
  return { email };
}
