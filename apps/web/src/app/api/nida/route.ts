import { NextResponse } from "next/server";
import { sandboxNidaLookup } from "@tz/shared";

/** NIDA identity lookup — auto-fills legal name, DOB, sex and nationality so
 *  the intake never asks for what the National ID already proves. */
export async function POST(req: Request) {
  const { nin } = (await req.json()) as { nin?: string };
  const clean = (nin ?? "").replace(/\D/g, "");
  if (clean.length !== 20) {
    return NextResponse.json({ error: "A National ID (NIN) is 20 digits." }, { status: 400 });
  }
  // Simulate the brief NIDA round-trip.
  await new Promise((r) => setTimeout(r, 450));
  const identity = sandboxNidaLookup(clean);
  if (!identity) {
    return NextResponse.json(
      { error: "We couldn't find that National ID with NIDA. Please check the number." },
      { status: 404 },
    );
  }
  return NextResponse.json({ identity });
}
