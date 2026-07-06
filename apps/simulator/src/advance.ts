import { db, getConfig } from "./db.js";
import { nowMs } from "./util.js";

/**
 * Status-advancement engine.
 *
 * Every long-running application row carries a `status`, an optional `due_at`
 * timestamp (ms) and a terminal number field. Advancement is done LAZILY on
 * each status-page GET (compare `due_at` to now) which makes tests
 * deterministic; a best-effort `setTimeout` also calls `sweepDue()`.
 */

export type Row = Record<string, any>;

function delayMs(): number {
  return getConfig().approvalDelayMs;
}

function isDue(row: Row): boolean {
  return row.due_at != null && nowMs() >= Number(row.due_at);
}

// ---- number formatting -----------------------------------------------------

export function reservationNumber(id: number): string {
  return `RSV-${1000 + id}`;
}
export function incorporationNumber(id: number): string {
  return String(100_000_000 + id);
}
export function companyTin(id: number): string {
  const raw = String(400_000_000 + id);
  return `${raw.slice(0, 3)}-${raw.slice(3, 6)}-${raw.slice(6, 9)}`;
}
export function vrnNumber(id: number): string {
  return `40-${String(id).padStart(6, "0")}-V`;
}
export function licenceNumber(portal: string, id: number): string {
  return `BL-${portal.toUpperCase()}-${1000 + id}`;
}
export function employerNumber(portal: string, id: number): string {
  return `${portal.toUpperCase()}-EMP-${100_000 + id}`;
}
export function oshaNumber(id: number): string {
  return `OSHA-WIMS-${10_000 + id}`;
}
export function appointmentRef(id: number): string {
  return `BIO-${1000 + id}`;
}
export function inspectionRef(id: number): string {
  return `INSP-${1000 + id}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---- lazy per-entity getters ----------------------------------------------

export function getReservation(id: number): Row | undefined {
  let row = db.prepare("SELECT * FROM reservations WHERE id = ?").get(id) as Row | undefined;
  if (row && row.status === "processing" && isDue(row)) {
    db.prepare(
      "UPDATE reservations SET status = 'reserved', reservation_number = ?, due_at = NULL WHERE id = ?",
    ).run(reservationNumber(row.id), row.id);
    row = db.prepare("SELECT * FROM reservations WHERE id = ?").get(id) as Row;
  }
  return row;
}

export function getApplication(id: number): Row | undefined {
  let row = db.prepare("SELECT * FROM applications WHERE id = ?").get(id) as Row | undefined;
  if (row && row.status === "under_review" && isDue(row)) {
    db.prepare(
      "UPDATE applications SET status = 'approved', incorporation_number = ?, incorporation_date = ?, due_at = NULL WHERE id = ?",
    ).run(incorporationNumber(row.id), today(), row.id);
    row = db.prepare("SELECT * FROM applications WHERE id = ?").get(id) as Row;
  }
  return row;
}

export function getLicence(id: number): Row | undefined {
  let row = db.prepare("SELECT * FROM licence_applications WHERE id = ?").get(id) as Row | undefined;
  if (row && row.status === "processing" && isDue(row)) {
    db.prepare(
      "UPDATE licence_applications SET status = 'issued', licence_number = ?, due_at = NULL WHERE id = ?",
    ).run(licenceNumber(row.portal, row.id), row.id);
    row = db.prepare("SELECT * FROM licence_applications WHERE id = ?").get(id) as Row;
  }
  return row;
}

export function getEmployer(id: number): Row | undefined {
  let row = db.prepare("SELECT * FROM employer_registrations WHERE id = ?").get(id) as Row | undefined;
  if (row && row.status === "processing" && isDue(row)) {
    db.prepare(
      "UPDATE employer_registrations SET status = 'registered', reg_number = ?, due_at = NULL WHERE id = ?",
    ).run(employerNumber(row.portal, row.id), row.id);
    row = db.prepare("SELECT * FROM employer_registrations WHERE id = ?").get(id) as Row;
  }
  return row;
}

export function getOsha(id: number): Row | undefined {
  let row = db.prepare("SELECT * FROM osha_registrations WHERE id = ?").get(id) as Row | undefined;
  if (row && row.status === "inspection_pending" && isDue(row)) {
    db.prepare(
      "UPDATE osha_registrations SET status = 'registered', osha_number = ?, due_at = NULL WHERE id = ?",
    ).run(oshaNumber(row.id), row.id);
    row = db.prepare("SELECT * FROM osha_registrations WHERE id = ?").get(id) as Row;
  }
  return row;
}

export function getTin(id: number): Row | undefined {
  let row = db.prepare("SELECT * FROM tin_applications WHERE id = ?").get(id) as Row | undefined;
  if (row && row.status === "biometrics_pending" && row.biometrics_done && isDue(row)) {
    db.prepare(
      "UPDATE tin_applications SET status = 'issued', tin = ?, due_at = NULL WHERE id = ?",
    ).run(companyTin(row.id), row.id);
    row = db.prepare("SELECT * FROM tin_applications WHERE id = ?").get(id) as Row;
  }
  return row;
}

export function getVat(id: number): Row | undefined {
  return db.prepare("SELECT * FROM vat_applications WHERE id = ?").get(id) as Row | undefined;
}

// ---- transitions triggered by _sim endpoints ------------------------------

/** A GePG bill for `linkedKind`/`linkedId` was paid; move it off pending_payment. */
export function onBillPaid(linkedKind: string, linkedId: number): void {
  const due = nowMs() + delayMs();
  if (linkedKind === "reservation") {
    db.prepare(
      "UPDATE reservations SET status = 'processing', due_at = ? WHERE id = ? AND status = 'pending_payment'",
    ).run(due, linkedId);
  } else if (linkedKind === "application") {
    db.prepare(
      "UPDATE applications SET status = 'under_review', due_at = ? WHERE id = ? AND status = 'pending_payment'",
    ).run(due, linkedId);
  } else if (linkedKind === "licence") {
    db.prepare(
      "UPDATE licence_applications SET status = 'processing', due_at = ? WHERE id = ? AND status = 'pending_payment'",
    ).run(due, linkedId);
  }
  scheduleSweep();
}

/** Employer (NSSF/WCF) registration auto-advances after approvalDelayMs. */
export function scheduleEmployer(id: number): void {
  db.prepare("UPDATE employer_registrations SET due_at = ? WHERE id = ?").run(nowMs() + delayMs(), id);
  scheduleSweep();
}

/** Biometrics completed for a TIN application → issue after approvalDelayMs. */
export function completeBiometrics(appointmentRefValue: string): Row | undefined {
  const row = db
    .prepare("SELECT * FROM tin_applications WHERE appointment_ref = ?")
    .get(appointmentRefValue) as Row | undefined;
  if (!row) return undefined;
  db.prepare(
    "UPDATE tin_applications SET biometrics_done = 1, due_at = ? WHERE id = ?",
  ).run(nowMs() + delayMs(), row.id);
  scheduleSweep();
  return row;
}

/** OSHA inspection completed → register after approvalDelayMs. */
export function completeInspection(refValue: string): Row | undefined {
  const row = db
    .prepare("SELECT * FROM osha_registrations WHERE inspection_ref = ?")
    .get(refValue) as Row | undefined;
  if (!row) return undefined;
  db.prepare("UPDATE osha_registrations SET due_at = ? WHERE id = ?").run(nowMs() + delayMs(), row.id);
  scheduleSweep();
  return row;
}

/** VAT physical verification completed → register immediately with a VRN. */
export function completeVatVerification(id: number): Row | undefined {
  const row = db.prepare("SELECT * FROM vat_applications WHERE id = ?").get(id) as Row | undefined;
  if (!row) return undefined;
  db.prepare(
    "UPDATE vat_applications SET status = 'registered', vrn = ? WHERE id = ? AND status != 'registered'",
  ).run(vrnNumber(row.id), row.id);
  return db.prepare("SELECT * FROM vat_applications WHERE id = ?").get(id) as Row;
}

// ---- best-effort background sweep -----------------------------------------

function scheduleSweep(): void {
  const wait = Math.max(0, delayMs()) + 50;
  setTimeout(() => {
    try {
      sweepDue();
    } catch {
      /* ignore */
    }
  }, wait).unref?.();
}

/** Promote every row whose review window has elapsed. Best effort only. */
export function sweepDue(): void {
  const due = db.prepare("SELECT id FROM reservations WHERE status = 'processing' AND due_at <= ?");
  for (const { id } of due.all(nowMs()) as { id: number }[]) getReservation(id);
  for (const { id } of (
    db.prepare("SELECT id FROM applications WHERE status = 'under_review' AND due_at <= ?").all(nowMs()) as {
      id: number;
    }[]
  ))
    getApplication(id);
  for (const { id } of (
    db.prepare("SELECT id FROM licence_applications WHERE status = 'processing' AND due_at <= ?").all(nowMs()) as {
      id: number;
    }[]
  ))
    getLicence(id);
  for (const { id } of (
    db.prepare("SELECT id FROM employer_registrations WHERE status = 'processing' AND due_at <= ?").all(nowMs()) as {
      id: number;
    }[]
  ))
    getEmployer(id);
  for (const { id } of (
    db.prepare("SELECT id FROM osha_registrations WHERE status = 'inspection_pending' AND due_at <= ?").all(nowMs()) as {
      id: number;
    }[]
  ))
    getOsha(id);
  for (const { id } of (
    db
      .prepare("SELECT id FROM tin_applications WHERE status = 'biometrics_pending' AND biometrics_done = 1 AND due_at <= ?")
      .all(nowMs()) as { id: number }[]
  ))
    getTin(id);
}
