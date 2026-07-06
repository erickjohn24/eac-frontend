"use client";
import { useRef, useState } from "react";
import { ArrowUpRight, Check, Copy } from "lucide-react";

/** Copy a signing link to the clipboard, with a quiet confirmation. */
export function CopyLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function copy() {
    try {
      const url = new URL(path, window.location.origin).toString();
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard unavailable — the Open link still works
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        onClick={copy}
        className={`inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-sm)] border px-2.5 text-[0.78rem] font-medium transition-all duration-200 ${
          copied
            ? "border-success/30 bg-success/10 text-success"
            : "border-hairline bg-panel-2 text-fg-muted hover:border-tz-400/40 hover:text-fg"
        }`}
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? "Copied" : "Copy link"}
      </button>
      <a
        href={path}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-8 items-center gap-1 rounded-[var(--radius-sm)] px-2 text-[0.78rem] font-medium text-tz-300 transition-colors hover:text-tz-400"
      >
        Open <ArrowUpRight className="size-3.5" />
      </a>
    </div>
  );
}
