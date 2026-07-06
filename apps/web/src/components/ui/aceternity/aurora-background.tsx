"use client";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/** Aceternity UI — Aurora Background, tuned to the Tanzanite palette. */
export function AuroraBackground({
  className,
  children,
  showRadialGradient = true,
}: {
  className?: string;
  children?: ReactNode;
  showRadialGradient?: boolean;
}) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden opacity-50"
        style={
          {
            "--aurora":
              "repeating-linear-gradient(100deg,#6366f1_10%,#7c6bf5_15%,#9a8bff_20%,#22d3ee_25%,#06b6d4_30%)",
            "--dark-gradient":
              "repeating-linear-gradient(100deg,#08080d_0%,#08080d_7%,transparent_10%,transparent_12%,#08080d_16%)",
            "--transparent": "transparent",
          } as React.CSSProperties
        }
      >
        <div
          className={cn(
            `after:animate-[var(--animate-aurora)] pointer-events-none absolute -inset-[10px] [background-image:var(--dark-gradient),var(--aurora)] [background-size:300%,_200%] [background-position:50%_50%,50%_50%] opacity-40 blur-[10px] filter will-change-transform`,
            `after:absolute after:inset-0 after:[background-image:var(--dark-gradient),var(--aurora)] after:[background-size:200%,_100%] after:[background-attachment:fixed] after:mix-blend-difference after:content-[""]`,
            showRadialGradient &&
              `[mask-image:radial-gradient(ellipse_at_100%_0%,black_10%,var(--transparent)_70%)]`,
          )}
        />
      </div>
      {children}
    </div>
  );
}
