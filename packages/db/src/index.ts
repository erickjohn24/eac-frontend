import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

export * from "./schema.js";
export { schema };

export type Db = ReturnType<typeof createDb>["db"];

let singleton: { db: Db; pool: pg.Pool } | null = null;

export function createDb(connectionString?: string) {
  const url =
    connectionString ??
    process.env.DATABASE_URL ??
    "postgres://tz:tz@localhost:5432/tz_compliance";
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  const db = drizzle(pool, { schema });
  return { db, pool };
}

/** Shared process-wide instance (web server / worker). */
export function getDb(): Db {
  if (!singleton) singleton = createDb();
  return singleton.db;
}

export function getPool(): pg.Pool {
  if (!singleton) singleton = createDb();
  return singleton.pool;
}

/** Postgres NOTIFY channel used to push realtime updates to the web app. */
export const NOTIFY_CHANNEL = "tz_events";

export async function notifyEvent(
  event: { type: string; companyId?: string; entityId?: string },
): Promise<void> {
  const pool = getPool();
  await pool.query(`SELECT pg_notify($1, $2)`, [
    NOTIFY_CHANNEL,
    JSON.stringify(event),
  ]);
}
