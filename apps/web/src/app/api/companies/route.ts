import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getDb, companies, people, users } from "@tz/db";
import { generateCompanyDocuments } from "@/lib/docs";
import type { OnboardingState } from "@/lib/onboarding-types";

/** Persist the onboarding draft as a Company + People, ready for the pipeline. */
export async function POST(req: Request) {
  const state = (await req.json()) as OnboardingState;
  const db = getDb();

  // ensure a demo owner exists (auth is added later)
  await db
    .insert(users)
    .values({
      id: "demo-user",
      name: "Demo Founder",
      email: "demo@tzcompliance.dev",
      emailVerified: true,
    })
    .onConflictDoNothing();

  const companyId = randomUUID();
  await db.insert(companies).values({
    id: companyId,
    ownerUserId: "demo-user",
    name: state.name,
    nameStatus: state.nameStatus === "available" ? "proposed" : "proposed",
    region: state.region,
    district: state.district,
    physicalAddress: state.physicalAddress,
    businessActivityIsic: state.activities.map((a) => a.code),
    activityDescription: state.activityDescription,
    shareCapitalTzs: state.shareCapitalTzs,
    totalShares: state.totalShares,
    fyEndMonth: state.fyEndMonth,
    expectedAnnualTurnoverTzs: state.expectedAnnualTurnoverTzs,
    voluntaryVat: false,
    employeeCount: state.employeeCount,
    status: "draft",
  });

  if (state.people.length > 0) {
    await db.insert(people).values(
      state.people.map((p) => ({
        id: randomUUID(),
        companyId,
        fullName: p.fullName,
        roles: p.roles,
        nationality: p.nationality,
        nin: p.isForeign ? null : p.nin.replace(/\D/g, "") || null,
        ninVerified: !p.isForeign && Boolean(p.identity),
        tin: p.tin || null,
        tinVerified: p.tinVerified,
        passportNo: p.isForeign ? p.passportNo : null,
        email: p.email || null,
        phone: p.phone || null,
        sharesHeld: p.sharesHeld,
        kycStatus: p.tinVerified || p.identity ? "verified" : "pending",
      })),
    );
  }

  // generate the incorporation documents + signature requests up front so
  // every signer has their link the moment the company exists
  const { documents, signatures } = await generateCompanyDocuments(companyId);

  return NextResponse.json({ id: companyId, documents, signatures });
}
