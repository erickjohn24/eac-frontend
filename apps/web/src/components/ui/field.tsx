"use client";
import { cn } from "@/lib/utils";
import { forwardRef } from "react";

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      {label && (
        <span className="mb-1.5 flex items-center gap-2 text-[0.8rem] font-medium text-fg-muted">
          {label}
        </span>
      )}
      {children}
      {error ? (
        <span className="mt-1.5 block text-[0.78rem] text-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-[0.78rem] text-fg-faint">{hint}</span>
      ) : null}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-[var(--radius)] border border-hairline bg-bg-2/60 px-3.5 text-[0.95rem] text-fg placeholder:text-fg-faint transition-all duration-200 focus:border-tz-400/60 focus:bg-bg-2 focus:outline-none focus:ring-4 focus:ring-tz-400/12",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "w-full rounded-[var(--radius)] border border-hairline bg-bg-2/60 p-3.5 text-[0.95rem] leading-relaxed text-fg placeholder:text-fg-faint transition-all duration-200 focus:border-tz-400/60 focus:bg-bg-2 focus:outline-none focus:ring-4 focus:ring-tz-400/12 resize-none",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "h-11 w-full appearance-none rounded-[var(--radius)] border border-hairline bg-bg-2/60 px-3.5 text-[0.95rem] text-fg transition-all duration-200 focus:border-tz-400/60 focus:outline-none focus:ring-4 focus:ring-tz-400/12",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";
