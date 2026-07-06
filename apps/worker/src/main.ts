import { getDb } from "@tz/db";
import { startRunner } from "@tz/engine";
import { startComplianceScheduler } from "./compliance-scheduler.js";
import { sendExpoPush } from "./push.js";

/**
 * The worker process: runs the pipeline step runner and the compliance
 * scheduler. Both poll Postgres, so multiple workers can run safely.
 */
const db = getDb();

console.log("[worker] starting pipeline runner and compliance scheduler");

const runner = startRunner({
  db,
  simulatorUrl: process.env.SIMULATOR_URL,
  storageRoot: process.env.STORAGE_ROOT,
  notifyPush: async (companyId, title, body) => {
    await sendExpoPush(db, companyId, title, body);
  },
});

const scheduler = startComplianceScheduler({ db });

async function shutdown() {
  console.log("[worker] shutting down");
  await runner.stop();
  scheduler.stop();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
