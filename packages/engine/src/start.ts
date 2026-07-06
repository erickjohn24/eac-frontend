import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { type Db, companies, pipelineRuns, stepRuns, notifyEvent } from "@tz/db";
import { PIPELINE, PIPELINE_VERSION, validatePipeline, type AutomationMode } from "@tz/shared";

/**
 * Create a pipeline run for a company and seed one step_run per pipeline step
 * (status `pending`). The runner picks them up as their dependencies clear.
 */
export async function startPipeline(
  db: Db,
  companyId: string,
  mode: AutomationMode = (process.env.AUTOMATION_MODE as AutomationMode) ?? "sandbox",
): Promise<{ pipelineRunId: string }> {
  validatePipeline();

  const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
  if (!company) throw new Error(`Company ${companyId} not found`);

  const pipelineRunId = randomUUID();
  await db.insert(pipelineRuns).values({
    id: pipelineRunId,
    companyId,
    pipelineVersion: PIPELINE_VERSION,
    mode,
    status: "running",
  });

  await db.insert(stepRuns).values(
    PIPELINE.steps.map((step) => ({
      id: randomUUID(),
      pipelineRunId,
      stepId: step.id,
      status: "pending" as const,
    })),
  );

  await db
    .update(companies)
    .set({ status: "in_pipeline", updatedAt: new Date() })
    .where(eq(companies.id, companyId));

  await notifyEvent({ type: "pipeline_started", companyId, entityId: pipelineRunId });
  return { pipelineRunId };
}
