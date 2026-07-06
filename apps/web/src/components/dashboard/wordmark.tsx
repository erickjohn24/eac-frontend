import Link from "next/link";

export function Wordmark({ href = "/dashboard" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5">
      <span className="tz-gradient grid size-8 place-items-center rounded-lg text-white shadow-[var(--shadow-glow)]">
        <span className="font-display text-lg font-semibold">t</span>
      </span>
      <span className="font-display text-lg font-medium tracking-tight">tz-compliance</span>
    </Link>
  );
}
