"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

/** Aceternity UI — Card Hover Effect (grid with animated hovered background). */
export function HoverEffect({
  items,
  className,
}: {
  items: { title: string; description: string; icon?: React.ReactNode }[];
  className?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  return (
    <div className={cn("grid gap-2 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {items.map((item, idx) => (
        <div
          key={item.title}
          className="group relative block h-full w-full p-1"
          onMouseEnter={() => setHovered(idx)}
          onMouseLeave={() => setHovered(null)}
        >
          <AnimatePresence>
            {hovered === idx && (
              <motion.span
                className="absolute inset-0 block h-full w-full rounded-[var(--radius-lg)] bg-tz-500/10"
                layoutId="hoverBackground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.15 } }}
                exit={{ opacity: 0, transition: { duration: 0.15, delay: 0.2 } }}
              />
            )}
          </AnimatePresence>
          <div className="card relative z-10 h-full p-6 transition-colors duration-300 group-hover:border-tz-400/40">
            {item.icon && (
              <span className="grid size-10 place-items-center rounded-[var(--radius)] border border-hairline bg-bg-2">
                {item.icon}
              </span>
            )}
            <h3 className="mt-4 text-lg">{item.title}</h3>
            <p className="mt-2 text-[0.9rem] leading-relaxed text-fg-muted">{item.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
