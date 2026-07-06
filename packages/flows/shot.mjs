import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const OUT = "/tmp/claude-0/-home-user-eac-frontend/257249e1-e60a-54ea-bb26-059a57c9e26d/scratchpad/shots2";
import fs from "node:fs"; fs.mkdirSync(OUT, { recursive: true });

const p = await b.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1.5 });
await p.goto("http://localhost:3000/onboarding", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(1500);
await p.screenshot({ path: `${OUT}/r-step1.jpg`, type: "jpeg", quality: 85 });

await p.fill("textarea", "A software studio building mobile apps for local businesses in Dar es Salaam");
await p.getByRole("button", { name: /Understand my business/i }).click();
await p.waitForTimeout(1400);
await p.screenshot({ path: `${OUT}/r-step1-thinking.jpg`, type: "jpeg", quality: 85 });
await p.waitForTimeout(2600);
await p.screenshot({ path: `${OUT}/r-step1-revealed.jpg`, type: "jpeg", quality: 85 });

await p.getByRole("button", { name: /Looks right/i }).click();
await p.waitForTimeout(900);
await p.screenshot({ path: `${OUT}/r-step2.jpg`, type: "jpeg", quality: 85, fullPage: true });

await p.fill('input[placeholder="Start typing…"]', "Ilala");
await p.fill('input[placeholder="Street / plot, building"]', "Plot 12, Nyerere Road");
await p.waitForTimeout(300);
await p.locator("main").getByRole("button", { name: /^Continue/ }).click();
await p.waitForTimeout(800);
await p.getByRole("button", { name: /Add the first director/i }).click();
await p.waitForTimeout(300);
await p.locator('input[placeholder="20-digit National ID"]').first().fill("11223344556677889900");
await p.waitForTimeout(1400);
await p.locator('input[placeholder="123-456-789"]').first().fill("123456789");
await p.waitForTimeout(900);
// shares: numeric input with % suffix inside Shares held field
await p.locator("label:has-text('Shares held') input").first().fill("100");
await p.locator('input[placeholder="you@company.co.tz"]').first().fill("amina@studio.co.tz");
await p.locator('input[placeholder="+255 7XX XXX XXX"]').first().fill("+255700000010");
await p.waitForTimeout(900);
await p.screenshot({ path: `${OUT}/r-step3.jpg`, type: "jpeg", quality: 85, fullPage: true });

await p.locator("main").getByRole("button", { name: /^Continue/ }).click();
await p.waitForTimeout(900);
await p.screenshot({ path: `${OUT}/r-step4.jpg`, type: "jpeg", quality: 85, fullPage: true });

// mobile pass
const m = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await m.goto("http://localhost:3000/onboarding", { waitUntil: "domcontentloaded" });
await m.waitForTimeout(1200);
await m.screenshot({ path: `${OUT}/r-m-step1.jpg`, type: "jpeg", quality: 85 });
await m.fill("textarea", "A tour and safari company in Arusha");
await m.getByRole("button", { name: /Understand my business/i }).click();
await m.waitForTimeout(4200);
await m.screenshot({ path: `${OUT}/r-m-revealed.jpg`, type: "jpeg", quality: 85, fullPage: true });

console.log("done");
await b.close();
