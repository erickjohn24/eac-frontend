import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { type Db, hitlRequests, signals, notifyEvent } from "@tz/db";
import type { HITLResolution } from "@tz/agent-core";

/**
 * Resolve an open HITL request (called from the API when the user submits an
 * OTP, confirms a payment, uploads a document, etc.). Writes the resolution and
 * a durable signal row; the blocked flow's `hitl.require()` picks it up.
 */
export async function resolveHitlRequest(
  db: Db,
  hitlId: string,
  userId: string,
  resolution: HITLResolution,
): Promise<{ ok: boolean }> {
  const [row] = await db.select().from(hitlRequests).where(eq(hitlRequests.id, hitlId));
  if (!row) return { ok: false };
  if (row.status !== "open") return { ok: true };

  await db
    .update(hitlRequests)
    .set({
      status: "completed",
      resolution: resolution as Record<string, unknown>,
      resolvedByUserId: userId,
      resolvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(hitlRequests.id, hitlId));

  await db.insert(signals).values({
    id: randomUUID(),
    stepRunId: row.stepRunId,
    name: `hitl:${(row.payload as Record<string, unknown>)?._key ?? row.type}`,
    payload: resolution as Record<string, unknown>,
  });

  await notifyEvent({ type: "hitl_resolved", companyId: row.companyId, entityId: hitlId });
  return { ok: true };
}

/** Expire overdue open HITL requests (called periodically by the runner). */
export async function expireStaleHitl(db: Db): Promise<void> {
  const open = await db.select().from(hitlRequests).where(eq(hitlRequests.status, "open"));
  const now = Date.now();
  for (const row of open) {
    if (row.expiresAt && row.expiresAt.getTime() < now) {
      await db
        .update(hitlRequests)
        .set({ status: "expired", updatedAt: new Date() })
        .where(and(eq(hitlRequests.id, row.id), eq(hitlRequests.status, "open")));
    }
  }
}
