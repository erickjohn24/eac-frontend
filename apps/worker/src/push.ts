import { eq } from "drizzle-orm";
import { type Db, companies, users } from "@tz/db";

/**
 * Send an Expo push notification to the company owner's registered devices.
 * In sandbox (no tokens) this logs; in production it POSTs to the Expo push API.
 */
export async function sendExpoPush(
  db: Db,
  companyId: string,
  title: string,
  body: string,
): Promise<void> {
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
  if (!company) return;
  const [owner] = await db.select().from(users).where(eq(users.id, company.ownerUserId));
  const tokens = owner?.expoPushTokens ?? [];
  if (tokens.length === 0) {
    console.log(`[push] (no devices) ${title} — ${body}`);
    return;
  }
  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        tokens.map((to) => ({ to, title, body, sound: "default", priority: "high" })),
      ),
    });
  } catch (e) {
    console.error("[push] failed", e);
  }
}
