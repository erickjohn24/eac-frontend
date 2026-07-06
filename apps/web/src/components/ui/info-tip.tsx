"use client";
import { useId, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { HelpCircle } from "lucide-react";

/**
 * Point-of-decision explanation. A small "?" that opens a plain-language
 * popover — the Clerky/Atlas pattern of teaching the concept next to the
 * field instead of assuming legal literacy.
 */
export function InfoTip({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`What is ${title}?`}
        onClick={() => setOpen((v) => !v)}
        onBlur={(e) => {
          if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) setOpen(false);
        }}
        className="grid size-[18px] place-items-center rounded-full text-fg-faint transition-colors hover:text-tz-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tz-400/60"
      >
        <HelpCircle className="size-[15px]" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.span
            id={id}
            role="tooltip"
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="absolute bottom-full left-1/2 z-40 mb-2 w-64 -translate-x-1/2 rounded-[var(--radius)] border border-hairline-2 bg-elevated p-3.5 shadow-[var(--shadow-soft)]"
          >
            <span className="block text-[0.78rem] font-semibold text-fg">{title}</span>
            <span className="mt-1 block text-[0.78rem] leading-relaxed font-normal normal-case tracking-normal text-fg-muted">
              {children}
            </span>
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
