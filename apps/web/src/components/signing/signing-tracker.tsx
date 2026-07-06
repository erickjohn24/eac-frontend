import { Check } from "lucide-react";
import { Badge } from "@/components/ui/chip";

export interface TrackerRequest {
  personId: string;
  fullName: string;
  docTitle: string;
  status: string;
}

function StatusPill({ status }: { status: string }) {
  if (status === "signed") {
    return (
      <Badge tone="success">
        <Check className="size-3" strokeWidth={3} />
        Signed
      </Badge>
    );
  }
  if (status === "declined") return <Badge tone="danger">Declined</Badge>;
  return <Badge>Waiting</Badge>;
}

/** Every signature the company is waiting on, grouped by person. Server-safe;
 *  used by the signing room and reusable anywhere signatures are tracked. */
export function SigningTracker({
  requests,
  youPersonId,
}: {
  requests: TrackerRequest[];
  youPersonId?: string;
}) {
  const groups = new Map<string, { fullName: string; items: TrackerRequest[] }>();
  for (const r of requests) {
    const g = groups.get(r.personId) ?? { fullName: r.fullName, items: [] };
    g.items.push(r);
    groups.set(r.personId, g);
  }
  const signed = requests.filter((r) => r.status === "signed").length;

  return (
    <section className="card p-6 sm:p-7">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-section">Who&apos;s signed</h2>
        <span className="text-caption tnum">
          {signed} of {requests.length} signed
        </span>
      </div>
      <div className="mt-5 space-y-6">
        {[...groups.entries()].map(([personId, g]) => (
          <div key={personId}>
            <p className="text-label">
              {g.fullName}
              {youPersonId === personId && <span className="text-fg-faint"> · you</span>}
            </p>
            <ul className="mt-2.5 divide-y divide-hairline/60">
              {g.items.map((item) => (
                <li
                  key={`${personId}-${item.docTitle}`}
                  className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                >
                  <span className="min-w-0 truncate text-[0.88rem] text-fg-muted">
                    {item.docTitle}
                  </span>
                  <StatusPill status={item.status} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
