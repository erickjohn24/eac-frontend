import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import {
  type Db,
  agentSessions,
  companies,
  pipelineRuns,
  stepRuns,
  notifyEvent,
} from "@tz/db";
import {
  GovtWait,
  HITLRequired,
  LocalStorage,
  isNonRetryable,
  openBrowserSession,
} from "@tz/agent-core";
import {
  PIPELINE,
  getStep,
  readySteps,
  type AutomationMode,
  type PortalId,
  type StepConditionInput,
} from "@tz/shared";
import { FLOW_REGISTRY, PORTAL_STEPS } from "@tz/flows";
import { buildFlowContext, type PushFn } from "./context.js";
import { expireStaleHitl } from "./signals.js";

export interface RunnerOptions {
  db: Db;
  simulatorUrl?: string;
  storageRoot?: string;
  pollIntervalMs?: number;
  concurrency?: number;
  notifyPush?: PushFn;
}

export interface RunnerController {
  stop(): Promise<void>;
  /** run a single scheduling tick (used by tests/demo) */
  tick(): Promise<void>;
}

export function startRunner(opts: RunnerOptions): RunnerController {
  const { db } = opts;
  const simulatorUrl = opts.simulatorUrl ?? process.env.SIMULATOR_URL ?? "http://localhost:4100";
  const storage = new LocalStorage(opts.storageRoot ?? process.env.STORAGE_ROOT ?? "./storage");
  const storageRoot = opts.storageRoot ?? process.env.STORAGE_ROOT ?? "./storage";
  const pollIntervalMs = opts.pollIntervalMs ?? Number(process.env.WORKER_POLL_INTERVAL_MS ?? 1000);
  const concurrency = opts.concurrency ?? 4;

  const running = new Set<string>(); // step_run ids currently executing in-process
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;

  async function executeStep(stepRunRow: typeof stepRuns.$inferSelect, mode: AutomationMode): Promise<void> {
    const stepDef = getStep(stepRunRow.stepId);
    const portal: PortalId = (stepDef.portal ?? "brela_ors") as PortalId;
    const [pipeline] = await db
      .select()
      .from(pipelineRuns)
      .where(eq(pipelineRuns.id, stepRunRow.pipelineRunId));
    if (!pipeline) return;

    // Gather inputs: merge result_data outputs of all completed steps in this run.
    const siblings = await db
      .select()
      .from(stepRuns)
      .where(eq(stepRuns.pipelineRunId, stepRunRow.pipelineRunId));
    const input: Record<string, unknown> = {};
    for (const s of siblings) {
      if (s.resultData && typeof s.resultData === "object") Object.assign(input, s.resultData);
    }

    // Lease + mark running.
    await db
      .update(stepRuns)
      .set({ status: "running", lockedBy: "runner", lockedAt: new Date(), startedAt: stepRunRow.startedAt ?? new Date(), updatedAt: new Date() })
      .where(eq(stepRuns.id, stepRunRow.id));
    await notifyEvent({ type: "step_started", companyId: pipeline.companyId, entityId: stepRunRow.stepId });

    const agentSessionId = randomUUID();
    await db.insert(agentSessions).values({
      id: agentSessionId,
      stepRunId: stepRunRow.id,
      companyId: pipeline.companyId,
      portal: stepDef.kind === "portal" ? portal : stepDef.kind,
      mode,
      status: "running",
    });

    const session = await openBrowserSession({ sessionId: agentSessionId, storageRoot });
    try {
      const ctx = buildFlowContext({
        db,
        companyId: pipeline.companyId,
        stepRunId: stepRunRow.id,
        agentSessionId,
        mode,
        portal,
        page: session.page,
        simulatorUrl,
        storage,
        notifyPush: opts.notifyPush,
      });

      const flow = FLOW_REGISTRY[stepRunRow.stepId];
      if (!flow) throw new Error(`No flow for step ${stepRunRow.stepId}`);

      const result = await flow(ctx, input);

      const { traceKey, videoKey } = await session.close();
      await db
        .update(agentSessions)
        .set({ status: "succeeded", endedAt: new Date(), traceStorageKey: traceKey, videoStorageKey: videoKey })
        .where(eq(agentSessions.id, agentSessionId));

      await db
        .update(stepRuns)
        .set({
          status: "succeeded",
          resultData: { ...(stepRunRow.resultData ?? {}), ...result.output },
          completedAt: new Date(),
          lockedBy: null,
          updatedAt: new Date(),
        })
        .where(eq(stepRuns.id, stepRunRow.id));
      await notifyEvent({ type: "step_succeeded", companyId: pipeline.companyId, entityId: stepRunRow.stepId });
    } catch (err) {
      await session.close().catch(() => {});
      await db
        .update(agentSessions)
        .set({ status: "failed", endedAt: new Date() })
        .where(eq(agentSessions.id, agentSessionId));

      if (err instanceof GovtWait) {
        await db
          .update(stepRuns)
          .set({ status: "pending", notBefore: new Date(Date.now() + err.pollAfterMs), lockedBy: null, updatedAt: new Date() })
          .where(eq(stepRuns.id, stepRunRow.id));
        return;
      }
      if (err instanceof HITLRequired) {
        // request expired/cancelled — leave awaiting_human for re-request on retry
        await db
          .update(stepRuns)
          .set({ status: "pending", notBefore: new Date(Date.now() + 5000), lockedBy: null, updatedAt: new Date() })
          .where(eq(stepRuns.id, stepRunRow.id));
        return;
      }

      const attempt = stepRunRow.attempt + 1;
      const nonRetryable = isNonRetryable(err);
      const message = err instanceof Error ? err.message : String(err);
      if (!nonRetryable && attempt < stepRunRow.maxAttempts) {
        const backoff = Math.min(2 ** attempt * 1000, 30_000);
        await db
          .update(stepRuns)
          .set({ status: "pending", attempt, notBefore: new Date(Date.now() + backoff), errorDetail: message, lockedBy: null, updatedAt: new Date() })
          .where(eq(stepRuns.id, stepRunRow.id));
      } else {
        await db
          .update(stepRuns)
          .set({ status: "failed", attempt, errorDetail: message, lockedBy: null, completedAt: new Date(), updatedAt: new Date() })
          .where(eq(stepRuns.id, stepRunRow.id));
        await db
          .update(pipelineRuns)
          .set({ status: "failed", updatedAt: new Date() })
          .where(eq(pipelineRuns.id, stepRunRow.pipelineRunId));
        await notifyEvent({ type: "step_failed", companyId: pipeline.companyId, entityId: stepRunRow.stepId });
      }
    } finally {
      running.delete(stepRunRow.id);
    }
  }

  async function tick(): Promise<void> {
    if (stopped) return;
    await expireStaleHitl(db).catch(() => {});

    const activePipelines = await db
      .select()
      .from(pipelineRuns)
      .where(eq(pipelineRuns.status, "running"));

    for (const pipeline of activePipelines) {
      const steps = await db.select().from(stepRuns).where(eq(stepRuns.pipelineRunId, pipeline.id));
      const statusMap = new Map(steps.map((s) => [s.stepId, s.status]));

      const [company] = await db.select().from(companies).where(eq(companies.id, pipeline.companyId));
      if (!company) continue;
      const conditionInput: StepConditionInput = {
        expectedAnnualTurnoverTzs: company.expectedAnnualTurnoverTzs,
        voluntaryVat: company.voluntaryVat,
        employeeCount: company.employeeCount,
      };

      // Terminal check: all steps succeeded/skipped (respecting conditions).
      const allDone = PIPELINE.steps.every((sd) => {
        const st = statusMap.get(sd.id) ?? "pending";
        if (st === "succeeded" || st === "skipped") return true;
        if (sd.condition && !conditionInputHolds(sd.condition, conditionInput)) return true;
        return false;
      });
      if (allDone) {
        await db.update(pipelineRuns).set({ status: "completed", completedAt: new Date(), updatedAt: new Date() }).where(eq(pipelineRuns.id, pipeline.id));
        await db.update(companies).set({ status: "registered", updatedAt: new Date() }).where(eq(companies.id, pipeline.companyId));
        await notifyEvent({ type: "pipeline_completed", companyId: pipeline.companyId, entityId: pipeline.id });
        continue;
      }

      // Skip conditional steps whose condition is false.
      for (const sd of PIPELINE.steps) {
        if (sd.condition && !conditionInputHolds(sd.condition, conditionInput)) {
          const st = statusMap.get(sd.id);
          if (st === "pending" || st === "blocked") {
            const row = steps.find((s) => s.stepId === sd.id);
            if (row) {
              await db.update(stepRuns).set({ status: "skipped", updatedAt: new Date() }).where(eq(stepRuns.id, row.id));
              statusMap.set(sd.id, "skipped");
            }
          }
        }
      }

      const ready = readySteps(statusMap, conditionInput);
      for (const rs of ready) {
        if (running.size >= concurrency) break;
        const row = steps.find((s) => s.stepId === rs.id);
        if (!row) continue;
        if (running.has(row.id)) continue;
        if (row.notBefore && row.notBefore.getTime() > Date.now()) continue;
        if (row.status !== "pending" && row.status !== "blocked") continue;
        running.add(row.id);
        void executeStep(row, pipeline.mode as AutomationMode);
      }
    }
  }

  function loop() {
    if (stopped) return;
    tick()
      .catch((e) => console.error("[runner] tick error", e))
      .finally(() => {
        if (!stopped) timer = setTimeout(loop, pollIntervalMs);
      });
  }
  loop();

  return {
    async stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      // wait for in-flight steps to settle briefly
      const deadline = Date.now() + 5000;
      while (running.size > 0 && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 200));
      }
    },
    tick,
  };
}

function conditionInputHolds(condition: string, input: StepConditionInput): boolean {
  if (condition === "vat_required") return input.voluntaryVat || input.expectedAnnualTurnoverTzs > 200_000_000;
  if (condition === "has_employees") return input.employeeCount > 0;
  return true;
}

export { inArray, and };
