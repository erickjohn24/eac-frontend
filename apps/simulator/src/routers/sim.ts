import { Router } from "express";
import { db, getConfig, setConfig, resetAll } from "./../db.js";
import { scheduleAdvance } from "./../scheduler.js";
import { randomDigits } from "./../util.js";
import { makeVrn } from "./tra.js";

export const simRouter = Router();

simRouter.post("/reset", (_req, res) => {
  resetAll();
  res.json({ ok: true });
});

simRouter.get("/config", (_req, res) => {
  res.json(getConfig());
});

simRouter.post("/config", (req, res) => {
  res.json(setConfig(req.body ?? {}));
});

simRouter.get("/messages", (req, res) => {
  const to = String(req.query.to ?? "");
  const rows = db
    .prepare("SELECT id, to_addr, channel, subject, body, sent_at FROM messages WHERE to_addr = ? ORDER BY id DESC")
    .all(to) as { id: number; to_addr: string; channel: string; subject: string; body: string; sent_at: string }[];
  res.json(
    rows.map((m) => ({
      id: m.id,
      to: m.to_addr,
      channel: m.channel,
      subject: m.subject,
      body: m.body,
      sentAt: m.sent_at,
    })),
  );
});

simRouter.get("/gepg/bills/:controlNumber", (req, res) => {
  const bill = db.prepare("SELECT * FROM bills WHERE control_number = ?").get(req.params.controlNumber) as
    | Record<string, unknown>
    | undefined;
  if (!bill) {
    res.status(404).json({ error: "bill_not_found" });
    return;
  }
  const out: Record<string, unknown> = {
    controlNumber: bill.control_number,
    amountTzs: bill.amount_tzs,
    payee: bill.payee,
    description: bill.description,
    status: bill.status,
  };
  if (bill.receipt_no) out.receiptNo = bill.receipt_no;
  res.json(out);
});

simRouter.post("/gepg/pay/:controlNumber", (req, res) => {
  const cn = req.params.controlNumber;
  const bill = db.prepare("SELECT * FROM bills WHERE control_number = ?").get(cn) as
    | { status: string; receipt_no: string | null; linked_kind: string | null; linked_id: number | null }
    | undefined;
  if (!bill) {
    res.status(404).json({ error: "bill_not_found" });
    return;
  }
  if (bill.status === "paid") {
    res.json({ status: "paid", receiptNo: bill.receipt_no });
    return;
  }
  const receiptNo = `RCT${randomDigits(10)}`;
  db.prepare("UPDATE bills SET status = 'paid', receipt_no = ? WHERE control_number = ?").run(receiptNo, cn);

  // Advance the linked entity out of pending_payment and start the review timer.
  if (bill.linked_kind && bill.linked_id != null) {
    const id = bill.linked_id;
    switch (bill.linked_kind) {
      case "reservation": {
        const r = db.prepare("SELECT status FROM reservations WHERE id = ?").get(id) as { status: string } | undefined;
        if (r?.status === "pending_payment") {
          db.prepare("UPDATE reservations SET status = 'processing' WHERE id = ?").run(id);
          scheduleAdvance("reservation", id);
        }
        break;
      }
      case "application": {
        const a = db.prepare("SELECT status FROM applications WHERE id = ?").get(id) as { status: string } | undefined;
        if (a?.status === "pending_payment") {
          db.prepare("UPDATE applications SET status = 'under_review' WHERE id = ?").run(id);
          scheduleAdvance("application", id);
        }
        break;
      }
      case "licence": {
        const l = db.prepare("SELECT status FROM licence_applications WHERE id = ?").get(id) as
          | { status: string }
          | undefined;
        if (l?.status === "pending_payment") {
          db.prepare("UPDATE licence_applications SET status = 'processing' WHERE id = ?").run(id);
          scheduleAdvance("licence", id);
        }
        break;
      }
    }
  }
  res.json({ status: "paid", receiptNo });
});

simRouter.post("/tra/biometrics/:appointmentRef", (req, res) => {
  const row = db.prepare("SELECT * FROM tin_applications WHERE appointment_ref = ?").get(req.params.appointmentRef) as
    | { id: number; status: string }
    | undefined;
  if (!row) {
    res.status(404).json({ error: "appointment_not_found" });
    return;
  }
  if (row.status === "issued") {
    res.json({ ok: true, status: "issued" });
    return;
  }
  db.prepare("UPDATE tin_applications SET biometrics_done = 1 WHERE id = ?").run(row.id);
  scheduleAdvance("tin", row.id);
  res.json({ ok: true, status: "biometrics_pending" });
});

simRouter.post("/tra/vat-verify/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM vat_applications WHERE id = ?").get(req.params.id) as
    | { id: number; status: string; vrn: string | null }
    | undefined;
  if (!row) {
    res.status(404).json({ error: "vat_application_not_found" });
    return;
  }
  if (row.status === "registered") {
    res.json({ ok: true, status: "registered", vrn: row.vrn });
    return;
  }
  const vrn = makeVrn();
  db.prepare("UPDATE vat_applications SET status = 'registered', vrn = ? WHERE id = ?").run(vrn, row.id);
  res.json({ ok: true, status: "registered", vrn });
});

simRouter.post("/osha/inspect/:ref", (req, res) => {
  const row = db.prepare("SELECT * FROM osha_registrations WHERE inspection_ref = ?").get(req.params.ref) as
    | { id: number; status: string; osha_number: string | null }
    | undefined;
  if (!row) {
    res.status(404).json({ error: "inspection_not_found" });
    return;
  }
  if (row.status === "registered") {
    res.json({ ok: true, status: "registered", oshaNumber: row.osha_number });
    return;
  }
  const oshaNumber = `OSHA-${randomDigits(8)}`;
  db.prepare("UPDATE osha_registrations SET status = 'registered', osha_number = ? WHERE id = ?").run(
    oshaNumber,
    row.id,
  );
  res.json({ ok: true, status: "registered", oshaNumber });
});
