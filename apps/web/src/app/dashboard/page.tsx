import Link from "next/link";
import type { Metadata } from "next";
import { desc, inArray } from "drizzle-orm";
import { ArrowRight, Building2, Plus } from "lucide-react";
import { getDb, companies, pipelineRuns, signatureRequests, stepRuns } from "@tz/db";
import { Badge } from "@/components/ui/chip";
import { Wordmark } from "@/components/dashboard/wordmark";
import { computeProgress, formatFullDate, statusPill } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your companies — tz-compliance",
};

export default async function DashboardPage() {
  const db = getDb();
  const rows = await db.select().from(companies).orderBy(desc(companies.createdAt));

  const ids = rows.map((c) => c.id);
  const sigTallies = new Map<string, { total: number; signed: number }>();
  const stepsByCompany = new Map<string, Map<string, string>>();

  if (ids.length > 0) {
    const [sigs, runs] = await Promise.all([
      db
        .select({ companyId: signatureRequests.companyId, status: signatureRequests.status })
        .from(signatureRequests)
        .where(inArray(signatureRequests.companyId, ids)),
      db
        .select({ id: pipelineRuns.id, companyId: pipelineRuns.companyId })
        .from(pipelineRuns)
        .where(inArray(pipelineRuns.companyId, ids))
        .orderBy(desc(pipelineRuns.startedAt)),
    ]);

    for (const s of sigs) {
      const t = sigTallies.get(s.companyId) ?? { total: 0, signed: 0 };
      t.total++;
      if (s.status === "signed") t.signed++;
      sigTallies.set(s.companyId, t);
    }

    // latest run per company
    const latestRun = new Map<string, string>();
    for (const r of runs) {
      if (!latestRun.has(r.companyId)) latestRun.set(r.companyId, r.id);
    }
    if (latestRun.size > 0) {
      const runIds = [...latestRun.values()];
      const steps = await db
        .select({ runId: stepRuns.pipelineRunId, stepId: stepRuns.stepId, status: stepRuns.status })
        .from(stepRuns)
        .where(inArray(stepRuns.pipelineRunId, runIds));
      const runToCompany = new Map([...latestRun.entries()].map(([c, r]) => [r, c]));
      for (const s of steps) {
        const companyId = runToCompany.get(s.runId);
        if (!companyId) continue;
        const m = stepsByCompany.get(companyId) ?? new Map<string, string>();
        m.set(s.stepId, s.status);
        stepsByCompany.set(companyId, m);
      }
    }
  }

  return (
    <div className="relative min-h-dvh">
      <div className="backdrop" />

      <header className="sticky top-0 z-30 border-b border-hairline bg-bg/85 backdrop-blur-lg">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between px-5 py-3">
          <Wordmark />
          <Link
            href="/onboarding"
            className="tz-gradient inline-flex h-9 items-center gap-1.5 rounded-[var(--radius)] px-4 text-[0.85rem] font-medium text-white shadow-[var(--shadow-glow)] transition-all duration-200 hover:-translate-y-px hover:brightness-110"
          >
            <Plus className="size-4" /> Register a company
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-[1100px] px-5 pb-24 pt-12">
        <p className="text-eyebrow">Dashboard</p>
        <h1 className="text-display mt-2.5">Your companies</h1>
        <p className="mt-2 text-[0.95rem] text-fg-muted">
          Everything you&apos;re registering and running, in one place.
        </p>

        {rows.length === 0 ? (
          <div className="card mt-10 grid place-items-center px-6 py-20 text-center">
            <span className="tz-gradient grid size-12 place-items-center rounded-2xl text-white shadow-[var(--shadow-glow)]">
              <Building2 className="size-6" />
            </span>
            <p className="text-title mt-5">No companies yet — register your first one.</p>
            <p className="mt-2 max-w-sm text-[0.9rem] text-fg-muted">
              Ten minutes of questions, and our agents handle BRELA, TRA, licences and the bank.
            </p>
            <Link
              href="/onboarding"
              className="tz-gradient mt-6 inline-flex h-11 items-center gap-2 rounded-[var(--radius)] px-6 text-[0.95rem] font-medium text-white shadow-[var(--shadow-glow)] transition-all duration-200 hover:-translate-y-px hover:brightness-110"
            >
              Register a company <ArrowRight className="size-4" />
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {rows.map((company) => {
              const pill = statusPill(company.status);
              const progress = computeProgress(
                company.employeeCount,
                stepsByCompany.get(company.id) ?? null,
                sigTallies.get(company.id) ?? { total: 0, signed: 0 },
              );
              return (
                <Link
                  key={company.id}
                  href={`/dashboard/${company.id}`}
                  className="card group block p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-tz-400/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-title min-w-0 truncate">{company.name}</h2>
                    <ArrowRight className="mt-1.5 size-4 shrink-0 text-fg-faint transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-tz-300" />
                  </div>
                  <div className="mt-2.5 flex items-center gap-2.5">
                    <Badge tone={pill.tone}>{pill.label}</Badge>
                    <span className="text-caption">
                      Started {formatFullDate(company.createdAt)}
                    </span>
                  </div>
                  <div className="mt-5 flex items-center gap-3">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-bg-2">
                      <div
                        className="tz-gradient h-full rounded-full"
                        style={{ width: `${Math.max(progress, 3)}%` }}
                      />
                    </div>
                    <span className="tnum text-[0.78rem] font-medium text-fg-muted">
                      {progress}%
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
