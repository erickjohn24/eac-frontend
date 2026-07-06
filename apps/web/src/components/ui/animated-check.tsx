"use client";
import { motion, useReducedMotion } from "motion/react";

/** A checkmark that draws itself — used for verification ticks and staged
 *  sequence completion so validation feels earned, not popped-in. */
export function AnimatedCheck({
  className,
  size = 16,
  delay = 0,
}: {
  className?: string;
  size?: number;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <motion.path
        d="M4.5 12.5l5 5 10-11"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduced ? { pathLength: 1 } : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  );
}

/** Count-up number for totals; falls back to static for reduced motion. */
export function CountUp({ value, format }: { value: number; format?: (n: number) => string }) {
  const reduced = useReducedMotion();
  const fmt = format ?? ((n: number) => n.toLocaleString("en-US"));
  if (reduced) return <span className="tnum">{fmt(value)}</span>;
  return (
    <motion.span
      key={value}
      className="tnum inline-block"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      {fmt(value)}
    </motion.span>
  );
}
