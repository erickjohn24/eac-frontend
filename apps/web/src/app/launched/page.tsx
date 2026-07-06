import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Meteors } from "@/components/ui/aceternity/meteors";

export default function LaunchedPage() {
  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden grain px-5">
      <div className="aurora" />
      <Meteors number={18} />
      <div className="relative z-10 max-w-lg text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl tz-gradient text-white shadow-[var(--shadow-glow)]">
          <CheckCircle2 className="size-8" />
        </div>
        <h1 className="mt-6 text-[2.2rem] leading-tight">Your registration is underway</h1>
        <p className="mt-3 text-[1.02rem] leading-relaxed text-fg-muted">
          Our AI agents are opening the BRELA portal now. We'll notify you the moment we
          need you to approve a payment or enter a code — and nothing before then.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/dashboard">
            <Button size="lg">Go to your dashboard</Button>
          </Link>
          <Link href="/onboarding">
            <Button variant="ghost" size="lg">
              Register another
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
