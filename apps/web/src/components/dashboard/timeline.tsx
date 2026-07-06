import { Check, TriangleAlert } from "lucide-react";
import type { TimelineItem } from "@/lib/dashboard";
import { PulseDot } from "./pulse-dot";

/** The registration timeline: every step of the journey with its live state. */
export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol>
      {items.map((item, i) => (
        <li key={item.id} className="relative flex gap-4 pb-6 last:pb-0">
          {i < items.length - 1 && (
            <span
              aria-hidden
              className={`absolute left-[13px] top-8 h-[calc(100%-1.75rem)] w-px ${
                item.state === "done" ? "bg-tz-400/50" : "bg-hairline"
              }`}
            />
          )}

          {/* status icon */}
          {item.state === "done" ? (
            <span className="tz-gradient grid size-7 shrink-0 place-items-center rounded-full text-white">
              <Check className="size-3.5" strokeWidth={3} />
            </span>
          ) : item.state === "active" ? (
            <span className="grid size-7 shrink-0 place-items-center rounded-full border-2 border-tz-400/70 bg-tz-500/10">
              <PulseDot />
            </span>
          ) : (
            <span className="size-7 shrink-0 rounded-full border border-hairline bg-bg-2" />
          )}

          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex items-baseline justify-between gap-3">
              <p
                className={`text-[0.9rem] font-medium ${
                  item.state === "waiting" ? "text-fg-faint" : "text-fg"
                }`}
              >
                {item.title}
              </p>
              {item.eta && (
                <span className="tnum shrink-0 rounded-full border border-hairline bg-panel-2 px-2.5 py-1 text-[0.72rem] font-medium text-fg-muted">
                  {item.eta}
                </span>
              )}
            </div>
            {item.statusText && (
              <p className="mt-1 text-[0.82rem] leading-snug text-tz-300">{item.statusText}</p>
            )}
            {item.needsYou && (
              <p className="text-caption mt-1">Needs you once: {item.needsYou}</p>
            )}

            {item.action && (
              <div className="mt-2.5 rounded-[var(--radius)] border border-warning/30 bg-warning/[0.06] p-3.5">
                <p className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-warning">
                  <TriangleAlert className="size-3" /> Action needed
                </p>
                <p className="mt-1.5 text-[0.85rem] font-medium text-fg">{item.action.title}</p>
                {item.action.instructions && (
                  <p className="text-caption mt-0.5">{item.action.instructions}</p>
                )}
                <button
                  type="button"
                  title="Available when filing starts"
                  className="mt-2.5 inline-flex h-8 cursor-not-allowed items-center rounded-[var(--radius-sm)] border border-warning/35 px-3 text-[0.78rem] font-medium text-warning opacity-90"
                >
                  Resolve
                </button>
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
