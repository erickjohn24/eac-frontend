"use client";
import { useState } from "react";
import { motion } from "motion/react";
import { Sparkles } from "lucide-react";

/** The post-launch welcome. Dismissible, and explains the one thing that
 *  moves the registration forward right now. */
export function LaunchedBanner({ hasSignatures }: { hasSignatures: boolean }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-[var(--radius-lg)] border border-tz-400/30 bg-tz-500/[0.08] p-5"
    >
      <div className="flex items-start gap-3.5">
        <span className="tz-gradient grid size-9 shrink-0 place-items-center rounded-xl text-white">
          <Sparkles className="size-4" />
        </span>
        <div className="min-w-0 pr-10">
          <p className="text-section text-fg">Karibu! We&apos;re preparing your documents.</p>
          <p className="mt-1 text-[0.85rem] leading-relaxed text-fg-muted">
            {hasSignatures
              ? "First up: signatures. Send each person their signing link below — we file with BRELA the moment the last signature lands."
              : "Your Memarts, declaration and board resolution are being drafted now. Signature links for each director appear below in a few moments — nothing needed from you yet."}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setHidden(true)}
        className="absolute right-4 top-4 text-[0.78rem] font-medium text-fg-faint transition-colors hover:text-fg"
      >
        hide
      </button>
    </motion.div>
  );
}
