import { NextResponse } from "next/server";
import { sandboxTinVerify } from "@tz/shared";

/** TIN verification against TRA (as BRELA ORS does live). Confirms the number
 *  and its registered name so the director's TIN is never entered blind. */
export async function POST(req: Request) {
  const { tin, name } = (await req.json()) as { tin?: string; name?: string };
  await new Promise((r) => setTimeout(r, 400));
  const result = sandboxTinVerify(tin ?? "", name);
  return NextResponse.json(result);
}
