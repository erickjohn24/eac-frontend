import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { getDb, companies, signatureRequests } from "@tz/db";
import { loadSigningContext } from "@/lib/signing";

/** The signing room payload for a signing link. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const ctx = await loadSigningContext(token);
  if (!ctx) {
    return NextResponse.json({ error: "This signing link isn't valid anymore." }, { status: 404 });
  }
  return NextResponse.json({
    document: ctx.document,
    signer: { fullName: ctx.signer.fullName, roles: ctx.signer.roles },
    company: { name: ctx.company.name },
    status: ctx.status,
    others: ctx.others.map(({ fullName, docTitle, status }) => ({ fullName, docTitle, status })),
  });
}

/** Sign the document: a typed legal name plus explicit consent. Idempotent. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const body = (await req.json().catch(() => null)) as {
    signatureText?: unknown;
    consent?: unknown;
  } | null;

  const signatureText =
    typeof body?.signatureText === "string" ? body.signatureText.trim() : "";
  if (signatureText.length < 3) {
    return NextResponse.json(
      { error: "Type your full legal name to sign." },
      { status: 400 },
    );
  }
  if (body?.consent !== true) {
    return NextResponse.json(
      { error: "Confirm you intend this typed name to be your legal signature." },
      { status: 400 },
    );
  }

  const db = getDb();
  const [request] = await db
    .select()
    .from(signatureRequests)
    .where(eq(signatureRequests.token, token));
  if (!request) {
    return NextResponse.json({ error: "This signing link isn't valid anymore." }, { status: 404 });
  }

  if (request.status !== "signed") {
    await db
      .update(signatureRequests)
      .set({
        status: "signed",
        signatureText,
        signedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(signatureRequests.id, request.id));
  }

  // when the last signature lands, the company is ready to file
  const remaining = await db
    .select({ id: signatureRequests.id })
    .from(signatureRequests)
    .where(
      and(
        eq(signatureRequests.companyId, request.companyId),
        ne(signatureRequests.status, "signed"),
      ),
    );
  const allSigned = remaining.length === 0;
  if (allSigned) {
    await db
      .update(companies)
      .set({ status: "ready_to_file", updatedAt: new Date() })
      .where(and(eq(companies.id, request.companyId), eq(companies.status, "draft")));
  }

  return NextResponse.json({ status: "signed", allSigned });
}
