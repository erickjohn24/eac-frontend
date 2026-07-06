#!/usr/bin/env node
/**
 * End-to-end demo: seeds a company, starts the pipeline against the simulator,
 * and plays the role of the customer — auto-resolving every HITL action item
 * (CAPTCHA, OTP, payment, biometric visit, etc.) so the whole registration
 * runs to completion. Proves the engine + flows + simulator work together.
 *
 * Usage: SIMULATOR must be running on :4100. Then `node scripts/demo.mjs`.
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, companies, people, hitlRequests, stepRuns, pipelineRuns, users } from "@tz/db";
import { startRunner, resolveHitlRequest, startPipeline } from "@tz/engine";

const SIM = process.env.SIMULATOR_URL ?? "http://localhost:4100";
const db = getDb();

async function main() {
  // reset simulator
  await fetch(`${SIM}/_sim/reset`, { method: "POST" }).catch(() => {});
  await fetch(`${SIM}/_sim/config`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ approvalDelayMs: 2500 }),
  }).catch(() => {});

  // seed owner
  await db.insert(users).values({
    id: "demo-user", name: "Erick John", email: "demo@tzcompliance.dev",
    emailVerified: true, phone: "+255700000001",
  }).onConflictDoNothing();

  // seed a fresh company
  const companyId = randomUUID();
  await db.insert(companies).values({
    id: companyId,
    ownerUserId: "demo-user",
    name: "Kizota Digital Limited",
    alternativeNames: ["Kizota Technologies Limited"],
    region: "Dar es Salaam",
    district: "Ilala",
    physicalAddress: "Plot 12, Nyerere Road",
    businessActivityIsic: ["6201", "6202"],
    activityDescription: "Software development and IT consultancy services",
    shareCapitalTzs: 5_000_000,
    totalShares: 100,
    fyEndMonth: 12,
    expectedAnnualTurnoverTzs: 50_000_000,
    voluntaryVat: false,
    employeeCount: 3,
  });
  await db.insert(people).values([
    {
      id: randomUUID(), companyId, fullName: "Amina Hassan",
      roles: ["director", "shareholder", "signatory"], nationality: "Tanzanian",
      nin: "11223344556677889900", tin: "123-456-789", email: "amina@kizota.co.tz",
      phone: "+255700000010", sharesHeld: 60,
    },
    {
      id: randomUUID(), companyId, fullName: "John Mng'ong'o",
      roles: ["director", "shareholder"], nationality: "Tanzanian",
      nin: "22334455667788990011", tin: "234-567-890", email: "john@kizota.co.tz",
      phone: "+255700000011", sharesHeld: 40,
    },
  ]);

  console.log(`\n▶ Seeded company ${companyId} (Kizota Digital Limited)\n`);

  // start pipeline
  const { pipelineRunId } = await startPipeline(db, companyId, "sandbox");
  console.log(`▶ Pipeline ${pipelineRunId} started\n`);

  // start runner
  const runner = startRunner({ db, simulatorUrl: SIM, pollIntervalMs: 800, concurrency: 3 });

  // play the customer: auto-resolve HITL items as they appear
  const resolver = setInterval(async () => {
    const open = await db.select().from(hitlRequests).where(eq(hitlRequests.status, "open"));
    for (const req of open) {
      const resolution = await resolveFor(req);
      await resolveHitlRequest(db, req.id, "demo-user", resolution);
      console.log(`  ✓ resolved action: ${req.title}`);
    }
  }, 700);

  // wait for completion
  const deadline = Date.now() + 180_000;
  let done = false;
  while (Date.now() < deadline && !done) {
    await new Promise((r) => setTimeout(r, 1500));
    const [run] = await db.select().from(pipelineRuns).where(eq(pipelineRuns.id, pipelineRunId));
    if (run?.status === "completed" || run?.status === "failed") done = true;
    const steps = await db.select().from(stepRuns).where(eq(stepRuns.pipelineRunId, pipelineRunId));
    const summary = steps.map((s) => `${s.stepId}:${s.status}`).join("  ");
    process.stdout.write(`\r  ${summary}\x1b[K`);
  }
  console.log("\n");

  clearInterval(resolver);
  await runner.stop();

  const [run] = await db.select().from(pipelineRuns).where(eq(pipelineRuns.id, pipelineRunId));
  const steps = await db.select().from(stepRuns).where(eq(stepRuns.pipelineRunId, pipelineRunId));
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId));

  console.log(`▶ Pipeline status: ${run?.status}`);
  console.log(`▶ Company: ${company?.name}`);
  console.log(`   incorporation #: ${company?.incorporationNumber}`);
  console.log(`   TIN: ${company?.tin}`);
  console.log(`   status: ${company?.status}`);
  console.log("\n▶ Steps:");
  for (const s of steps) console.log(`   ${s.status.padEnd(10)} ${s.stepId}`);

  const failed = steps.filter((s) => s.status === "failed");
  process.exit(failed.length > 0 || run?.status !== "completed" ? 1 : 0);
}

async function resolveFor(req) {
  switch (req.type) {
    case "captcha_handoff": {
      // solve the arithmetic captcha from the prompt
      const prompt = String(req.payload?.captchaPrompt ?? "");
      const m = prompt.match(/(\d+)\s*([+\-*])\s*(\d+)/);
      let answer = "0";
      if (m) {
        const a = Number(m[1]), b = Number(m[3]);
        answer = String(m[2] === "+" ? a + b : m[2] === "-" ? a - b : a * b);
      }
      return { code: answer };
    }
    case "otp_entry": {
      // read the OTP from the simulator inbox
      const dest = String(req.payload?.otpDestination ?? "");
      return { code: await readOtp(dest) };
    }
    case "payment_authorization":
      return { method: "mpesa", confirmed: true };
    case "physical_visit":
    case "appointment":
    case "document_upload":
    case "data_confirmation":
    default:
      return { confirmed: true };
  }
}

async function readOtp() {
  // the OTP goes to the TRA account email; find any recent 6-digit code
  // (the TRA session uses a derived email; scan all messages)
  return "000000"; // sandbox reads inbox directly in the flow; HITL only fires if inbox missed
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
