import { db, getConfig } from "./db.js";
import { randomDigits } from "./util.js";

/**
 * Timed status advancement ("review" completion). Each pending advancement
 * persists a due_at timestamp on its row so that overdue rows can be re-armed
 * after a restart.
 */

export type TimedKind = "reservation" | "application" | "tin" | "licence" | "employer";

function advance(kind: TimedKind, id: number): void {
  switch (kind) {
    case "reservation": {
      const row = db.prepare("SELECT * FROM reservations WHERE id = ?").get(id) as { status: string } | undefined;
      if (!row || row.status !== "processing") return;
      db.prepare("UPDATE reservations SET status = 'reserved', due_at = NULL WHERE id = ?").run(id);
      break;
    }
    case "application": {
      const row = db.prepare("SELECT * FROM applications WHERE id = ?").get(id) as { status: string } | undefined;
      if (!row || row.status !== "under_review") return;
      const incNo = String(100_000_000 + Math.floor(Math.random() * 900_000_000));
      db.prepare(
        "UPDATE applications SET status = 'approved', incorporation_number = ?, incorporation_date = ?, due_at = NULL WHERE id = ?",
      ).run(incNo, new Date().toISOString().slice(0, 10), id);
      break;
    }
    case "tin": {
      const row = db.prepare("SELECT * FROM tin_applications WHERE id = ?").get(id) as
        | { status: string; biometrics_done: number }
        | undefined;
      if (!row || row.status === "issued" || !row.biometrics_done) return;
      const tin = `4${randomDigits(2)}-${randomDigits(3)}-${randomDigits(3)}`;
      db.prepare("UPDATE tin_applications SET status = 'issued', tin = ?, due_at = NULL WHERE id = ?").run(tin, id);
      break;
    }
    case "licence": {
      const row = db.prepare("SELECT * FROM licence_applications WHERE id = ?").get(id) as
        | { status: string; portal: string }
        | undefined;
      if (!row || row.status !== "processing") return;
      const prefix = row.portal === "tausi" ? "B" : "A";
      const licNo = `${prefix}-${randomDigits(7)}`;
      db.prepare("UPDATE licence_applications SET status = 'issued', licence_number = ?, due_at = NULL WHERE id = ?").run(
        licNo,
        id,
      );
      break;
    }
    case "employer": {
      const row = db.prepare("SELECT * FROM employer_registrations WHERE id = ?").get(id) as
        | { status: string; portal: string }
        | undefined;
      if (!row || row.status !== "processing") return;
      const regNo = `${row.portal.toUpperCase()}-${randomDigits(8)}`;
      db.prepare(
        "UPDATE employer_registrations SET status = 'registered', reg_number = ?, due_at = NULL WHERE id = ?",
      ).run(regNo, id);
      break;
    }
  }
}

const KIND_TABLE: Record<TimedKind, string> = {
  reservation: "reservations",
  application: "applications",
  tin: "tin_applications",
  licence: "licence_applications",
  employer: "employer_registrations",
};

export function scheduleAdvance(kind: TimedKind, id: number, delayMs?: number): void {
  const delay = delayMs ?? getConfig().approvalDelayMs;
  const dueAt = Date.now() + delay;
  db.prepare(`UPDATE ${KIND_TABLE[kind]} SET due_at = ? WHERE id = ?`).run(dueAt, id);
  const t = setTimeout(() => advance(kind, id), delay);
  t.unref?.();
}

/** Re-arm timers for rows that still have a due_at (e.g. after a restart). */
export function rearmPending(): void {
  for (const kind of Object.keys(KIND_TABLE) as TimedKind[]) {
    const rows = db.prepare(`SELECT id, due_at FROM ${KIND_TABLE[kind]} WHERE due_at IS NOT NULL`).all() as {
      id: number;
      due_at: number;
    }[];
    for (const row of rows) {
      const delay = Math.max(0, row.due_at - Date.now());
      const t = setTimeout(() => advance(kind, row.id), delay);
      t.unref?.();
    }
  }
}
