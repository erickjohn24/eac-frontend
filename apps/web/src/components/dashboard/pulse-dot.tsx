"use client";
import { motion, useReducedMotion } from "motion/react";

/** The "we're on it" indicator: a dot that breathes. */
export function PulseDot() {
  const reduced = useReducedMotion();
  if (reduced) return <span className="block size-2 rounded-full bg-tz-300" />;
  return (
    <motion.span
      className="block size-2 rounded-full bg-tz-300"
      animate={{ scale: [1, 1.55, 1], opacity: [1, 0.45, 1] }}
      transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}
