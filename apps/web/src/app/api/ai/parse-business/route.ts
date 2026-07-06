import { NextResponse } from "next/server";
import { understandBusiness } from "@/lib/ai";

export async function POST(req: Request) {
  const { text } = (await req.json()) as { text?: string };
  if (!text || text.trim().length < 4) {
    return NextResponse.json({ error: "Tell us a little about your business." }, { status: 400 });
  }
  const understanding = await understandBusiness(text.trim());
  return NextResponse.json(understanding);
}
