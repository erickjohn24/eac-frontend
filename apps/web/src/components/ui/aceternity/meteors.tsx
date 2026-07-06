"use client";
import { cn } from "@/lib/utils";

/** Aceternity UI — Meteors effect. */
export function Meteors({ number = 20, className }: { number?: number; className?: string }) {
  const meteors = new Array(number).fill(true);
  return (
    <>
      {meteors.map((_, idx) => {
        // deterministic spread (no Math.random at module scope for SSR stability)
        const left = Math.floor((idx / number) * 100);
        const delay = (idx % 5) * 0.6;
        const dur = 3 + (idx % 5);
        return (
          <span
            key={idx}
            className={cn(
              "animate-[var(--animate-meteor)] absolute top-1/2 left-1/2 size-0.5 rounded-full bg-tz-300 shadow-[0_0_0_1px_#ffffff10] rotate-[215deg]",
              "before:absolute before:top-1/2 before:h-px before:w-[50px] before:-translate-y-1/2 before:bg-gradient-to-r before:from-tz-300 before:to-transparent before:content-['']",
              className,
            )}
            style={{
              left: `${left}%`,
              animationDelay: `${delay}s`,
              animationDuration: `${dur}s`,
            }}
          />
        );
      })}
    </>
  );
}
