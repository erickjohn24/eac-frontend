import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  type Db,
  companies,
  complianceEvents,
  complianceObligations,
  pipelineRuns,
  stepRuns,
  notifyEvent,
} from "@tz/db";
import {
  applicableRules,
  nextDueDate,
  type CompanyComplianceProfile,
} from "@tz/shared";

/**
 * Compliance scheduler: once a company finishes registration, provision its
 * ongoing obligations from the rules catalog and keep the next upcoming
 * ComplianceEvent materialized for each. In sandbox this simply keeps the
 * calendar populated; auto-filing of returns is added in the compliance phase.
 */
export function startComplianceScheduler(opts: {
  db: Db;
  intervalMs?: number;
}): { stop(): void } {
  const { db } = opts;
  const intervalMs = opts.intervalMs ?? 15_000;
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;

  async function provisionFor(companyId: string): Promise<void> {
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (!company) return;

    const profile: CompanyComplianceProfile = {
      hasEmployees: company.employeeCount > 0,
      vatRegistered: Boolean(company.vrn),
      fyEndMonth: company.fyEndMonth,
      incorporationDate: (company.incorporationDate ?? new Date()).toISOString(),
    };

    for (const rule of applicableRules(profile)) {
      const existing = await db
        .select()
        .from(complianceObligations)
        .where(
          and(
            eq(complianceObligations.companyId, companyId),
            eq(complianceObligations.type, rule.type),
          ),
        );
      let obligationId = existing[0]?.id;
      const due = nextDueDate(rule, profile, new Date());
      if (!obligationId) {
        obligationId = randomUUID();
        await db.insert(complianceObligations).values({
          id: obligationId,
          companyId,
          type: rule.type,
          cadence: rule.cadence,
          nextDueDate: due,
          autoFileCapable: rule.autoFileCapable,
        });
      }

      // Ensure the next upcoming event exists.
      if (due) {
        const periodLabel = due.toISOString().slice(0, 7);
        await db
          .insert(complianceEvents)
          .values({
            id: randomUUID(),
            obligationId,
            companyId,
            periodLabel,
            dueDate: due,
            status: "upcoming",
          })
          .onConflictDoNothing();
      }
    }
    await notifyEvent({ type: "compliance_provisioned", companyId });
  }

  async function tick(): Promise<void> {
    if (stopped) return;
    // Companies that completed the pipeline and have the compliance.activate step succeeded.
    const completed = await db
      .select()
      .from(pipelineRuns)
      .where(eq(pipelineRuns.status, "completed"));
    for (const run of completed) {
      const [activate] = await db
        .select()
        .from(stepRuns)
        .where(
          and(
            eq(stepRuns.pipelineRunId, run.id),
            eq(stepRuns.stepId, "compliance.activate"),
          ),
        );
      if (activate?.status !== "succeeded") continue;
      const existing = await db
        .select()
        .from(complianceObligations)
        .where(eq(complianceObligations.companyId, run.companyId));
      if (existing.length === 0) {
        await provisionFor(run.companyId).catch((e) =>
          console.error("[compliance] provision error", e),
        );
        await db
          .update(companies)
          .set({ status: "compliant", updatedAt: new Date() })
          .where(eq(companies.id, run.companyId));
      }
    }
  }

  function loop() {
    if (stopped) return;
    tick()
      .catch((e) => console.error("[compliance] tick error", e))
      .finally(() => {
        if (!stopped) timer = setTimeout(loop, intervalMs);
      });
  }
  loop();

  return {
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}
