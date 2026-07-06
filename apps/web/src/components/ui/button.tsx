"use client";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { forwardRef } from "react";

const button = cva(
  "inline-flex items-center justify-center gap-2 font-medium rounded-[var(--radius)] transition-all duration-200 ease-[var(--ease-spring)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tz-400/60 disabled:opacity-45 disabled:pointer-events-none select-none active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary:
          "tz-gradient text-white shadow-[var(--shadow-glow)] hover:brightness-110 hover:-translate-y-px",
        secondary:
          "bg-elevated text-fg border border-hairline hover:bg-panel-2 hover:border-tz-400/40",
        ghost: "text-fg-muted hover:text-fg hover:bg-panel-2",
        outline: "border border-hairline text-fg hover:border-tz-400/50 hover:bg-panel-2",
      },
      size: {
        sm: "h-9 px-3.5 text-sm",
        md: "h-11 px-5 text-[0.95rem]",
        lg: "h-13 px-7 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(button({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";
