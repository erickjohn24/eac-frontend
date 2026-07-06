/** Drops and recreates the public schema, then re-runs migrations. Dev only. */
import { createDb } from "./index.js";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { db, pool } = createDb();

const dirname = path.dirname(fileURLToPath(import.meta.url));

await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
await migrate(db, { migrationsFolder: path.join(dirname, "..", "migrations") });
console.log("Database reset and migrated.");
await pool.end();
