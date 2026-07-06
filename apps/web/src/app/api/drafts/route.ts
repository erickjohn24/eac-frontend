import { randomBytes, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, onboardingDrafts } from "@tz/db";

/**
 * Save & resume. POST upserts the wizard state against a resume token;
 * GET ?token= restores it on any device. No account needed — the token IS
 * the key, like a boarding pass.
 */

export async function POST(req: Request) {
  const { token, state, email } = (await req.json()) as {
    token?: string;
    state?: Record<string, unknown>;
    email?: string;
  };
  if (!state || typeof state !== "object") {
    return NextResponse.json({ error: "Nothing to save yet." }, { status: 400 });
  }
  const db = getDb();

  if (token) {
    const [existing] = await db
      .select({ id: onboardingDrafts.id })
      .from(onboardingDrafts)
      .where(eq(onboardingDrafts.token, token));
    if (existing) {
      await db
        .update(onboardingDrafts)
        .set({ state, email: email ?? null, updatedAt: new Date() })
        .where(eq(onboardingDrafts.token, token));
      return NextResponse.json({ token });
    }
  }

  const freshToken = token ?? randomBytes(12).toString("base64url");
  await db.insert(onboardingDrafts).values({
    id: randomUUID(),
    token: freshToken,
    state,
    email: email ?? null,
  });
  return NextResponse.json({ token: freshToken });
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token." }, { status: 400 });
  const db = getDb();
  const [draft] = await db
    .select()
    .from(onboardingDrafts)
    .where(eq(onboardingDrafts.token, token));
  if (!draft) {
    return NextResponse.json(
      { error: "That resume link isn't valid anymore." },
      { status: 404 },
    );
  }
  return NextResponse.json({ state: draft.state, updatedAt: draft.updatedAt });
}
