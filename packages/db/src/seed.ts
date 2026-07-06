/** Seeds a demo user for local development and demos. */
import { createDb, users } from "./index.js";

const { db, pool } = createDb();

await db
  .insert(users)
  .values({
    id: "demo-user",
    name: "Erick John",
    email: "demo@tzcompliance.dev",
    emailVerified: true,
    phone: "+255700000001",
    locale: "en",
  })
  .onConflictDoNothing();

console.log("Seeded demo user demo@tzcompliance.dev");
await pool.end();
