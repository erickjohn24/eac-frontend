import { NextResponse } from "next/server";

/** Company-name availability. Tries the BRELA public search (sandbox simulator);
 *  falls back to a heuristic if the registry isn't reachable. */
const SEEDED_TAKEN = [
  "safari traders limited",
  "kilimanjaro holdings limited",
  "serengeti trading limited",
];

export async function POST(req: Request) {
  const { name } = (await req.json()) as { name?: string };
  const trimmed = (name ?? "").trim();
  if (trimmed.length < 3) {
    return NextResponse.json({ status: "invalid", reason: "Too short." });
  }
  if (!/limited$/i.test(trimmed)) {
    return NextResponse.json({
      status: "advice",
      reason: "A private company name must end in “Limited”.",
    });
  }

  const sim = process.env.SIMULATOR_URL ?? "http://localhost:4100";
  try {
    const res = await fetch(
      `${sim}/brela-ors/name-search?q=${encodeURIComponent(trimmed)}`,
      { signal: AbortSignal.timeout(2500) },
    );
    if (res.ok) {
      const html = await res.text();
      const m = html.match(/data-status="(available|taken)"/);
      if (m) {
        return NextResponse.json({
          status: m[1],
          reason: m[1] === "taken" ? "That name is already on the register." : undefined,
        });
      }
    }
  } catch {
    /* registry unreachable — heuristic below */
  }

  const taken = SEEDED_TAKEN.includes(trimmed.toLowerCase());
  return NextResponse.json({
    status: taken ? "taken" : "available",
    reason: taken ? "That name is already on the register." : undefined,
  });
}
