import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import {
  type Db,
  agentActions,
  agentSessions,
  hitlRequests,
  notifyEvent,
  portalCredentials,
  stepRuns,
} from "@tz/db";
import {
  ClaudeAiLayer,
  GepgClient,
  HITLRequired,
  LocalStorage,
  SimulatorInbox,
  decryptSecret,
  disabledAiLayer,
  encryptSecret,
  type ActionRecorder,
  type FlowContext,
  type HITLResolution,
  type VaultClient,
} from "@tz/agent-core";
import {
  PORTALS,
  portalBaseUrl,
  type AutomationMode,
  type PortalId,
} from "@tz/shared";
import type { Page } from "playwright";
import { createRepo } from "./repo.js";

export interface BuildContextArgs {
  db: Db;
  companyId: string;
  stepRunId: string;
  agentSessionId: string;
  mode: AutomationMode;
  portal: PortalId;
  page: Page;
  simulatorUrl: string;
  storage: LocalStorage;
  notifyPush?: (companyId: string, title: string, body: string) => Promise<void>;
}

/** Notification hook the app can override to push to phones. */
export type PushFn = (companyId: string, title: string, body: string) => Promise<void>;

export function buildFlowContext(args: BuildContextArgs): FlowContext {
  const { db, companyId, stepRunId, agentSessionId, mode, portal, page } = args;
  const storage = args.storage;
  const portalUrl = portalBaseUrl(portal, mode, args.simulatorUrl);

  let seq = 0;
  const actions: ActionRecorder = {
    async record(action) {
      seq += 1;
      await db.insert(agentActions).values({
        id: randomUUID(),
        agentSessionId,
        seq,
        kind: action.kind,
        detail: action.detail,
        selector: action.selector ?? null,
        valueRedacted: action.valueRedacted ?? null,
        aiModel: action.aiModel ?? null,
        latencyMs: action.latencyMs ?? null,
      });
      await notifyEvent({ type: "agent_action", companyId, entityId: agentSessionId });
    },
    async screenshot(label) {
      seq += 1;
      const key = `agent-sessions/${agentSessionId}/frame-${String(seq).padStart(4, "0")}.jpg`;
      try {
        const buf = await page.screenshot({ type: "jpeg", quality: 70 });
        await storage.put(key, buf, "image/jpeg");
        await db
          .update(agentSessions)
          .set({ liveFrameKey: key })
          .where(eq(agentSessions.id, agentSessionId));
        await db.insert(agentActions).values({
          id: randomUUID(),
          agentSessionId,
          seq,
          kind: "screenshot",
          detail: label,
          screenshotKey: key,
        });
        await notifyEvent({ type: "agent_frame", companyId, entityId: agentSessionId });
      } catch {
        /* internal steps have no live page */
      }
      return key;
    },
  };

  const checkpoint: Record<string, unknown> = {};

  const vault: VaultClient = {
    async get(cid, p) {
      const [row] = await db
        .select()
        .from(portalCredentials)
        .where(and(eq(portalCredentials.companyId, cid), eq(portalCredentials.portal, p)));
      if (!row) return null;
      return { username: row.username, secret: decryptSecret(row.secretCiphertext, row.nonce) };
    },
    async set(cid, p, username, secret) {
      const { ciphertext, nonce } = encryptSecret(secret);
      await db
        .insert(portalCredentials)
        .values({ id: randomUUID(), companyId: cid, portal: p, username, secretCiphertext: ciphertext, nonce })
        .onConflictDoUpdate({
          target: [portalCredentials.companyId, portalCredentials.portal],
          set: { username, secretCiphertext: ciphertext, nonce, rotatedAt: new Date() },
        });
    },
  };

  const ai = process.env.ANTHROPIC_API_KEY ? new ClaudeAiLayer() : disabledAiLayer;
  const gepg = new GepgClient(portalBaseUrl("gepg", mode, args.simulatorUrl).replace(/\/gepg$/, ""));

  const hitl: FlowContext["hitl"] = {
    async require(request) {
      // Find an existing request for this step + key.
      const existing = await db
        .select()
        .from(hitlRequests)
        .where(eq(hitlRequests.stepRunId, stepRunId))
        .orderBy(desc(hitlRequests.createdAt));
      const match = existing.find((r) => (r.payload as Record<string, unknown>)?._key === request.key);

      if (match?.status === "completed") {
        return (match.resolution ?? {}) as HITLResolution;
      }

      let hitlId = match?.id;
      if (!match) {
        hitlId = randomUUID();
        const expiresAt = request.expiresInMinutes
          ? new Date(Date.now() + request.expiresInMinutes * 60_000)
          : null;
        await db.insert(hitlRequests).values({
          id: hitlId,
          stepRunId,
          companyId,
          type: request.type,
          title: request.title,
          instructionsMd: request.instructionsMd,
          payload: { ...(request.payload ?? {}), _key: request.key },
          status: "open",
          expiresAt,
        });
        await db
          .update(stepRuns)
          .set({ status: "awaiting_human", updatedAt: new Date() })
          .where(eq(stepRuns.id, stepRunId));
        await notifyEvent({ type: "hitl_created", companyId, entityId: hitlId });
        if (args.notifyPush) {
          await args.notifyPush(companyId, request.title, "Action needed to continue your registration.");
        }
      }

      // Block (durably) until the request is resolved or expires. The browser
      // stays open; the request row persists so web/mobile can resolve it.
      for (;;) {
        await new Promise((r) => setTimeout(r, 1000));
        const [row] = await db.select().from(hitlRequests).where(eq(hitlRequests.id, hitlId!));
        if (!row) throw new Error("HITL request vanished");
        if (row.status === "completed") {
          await db
            .update(stepRuns)
            .set({ status: "running", updatedAt: new Date() })
            .where(eq(stepRuns.id, stepRunId));
          await notifyEvent({ type: "hitl_resolved", companyId, entityId: hitlId });
          return (row.resolution ?? {}) as HITLResolution;
        }
        if (row.status === "expired" || row.status === "cancelled") {
          throw new HITLRequired(request); // surfaces as a retryable block
        }
      }
    },
  };

  return {
    companyId,
    stepRunId,
    mode,
    portal,
    portalUrl,
    page,
    actions,
    checkpoint,
    async memo(key, fn) {
      if (key in checkpoint) return checkpoint[key] as never;
      const result = await fn();
      checkpoint[key] = result;
      return result;
    },
    hitl,
    inbox: new SimulatorInbox(args.simulatorUrl),
    vault,
    storage,
    ai,
    repo: createRepo(db, storage),
    gepg,
    logger: (msg) => console.log(`[${portal}:${stepRunId.slice(0, 8)}] ${msg}`),
  };
}

export { PORTALS };
