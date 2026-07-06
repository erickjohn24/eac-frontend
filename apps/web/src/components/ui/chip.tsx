"use client";
import { cn } from "@/lib/utils";

export function Chip({
  active,
  children,
  onClick,
  className,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[0.82rem] font-medium transition-all duration-200 ease-[var(--ease-spring)] active:scale-95",
        active
          ? "border-tz-400/50 bg-tz-500/15 text-fg tz-ring"
          : "border-hairline bg-panel-2 text-fg-muted hover:border-tz-400/30 hover:text-fg",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "neutral" | "success" | "warning" | "danger" | "tz";
  children: React.ReactNode;
  className?: string;
}) {
  const tones = {
    neutral: "bg-panel-2 text-fg-muted border-hairline",
    success: "bg-success/12 text-success border-success/25",
    warning: "bg-warning/12 text-warning border-warning/25",
    danger: "bg-danger/12 text-danger border-danger/25",
    tz: "bg-tz-500/15 text-tz-300 border-tz-400/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.72rem] font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
