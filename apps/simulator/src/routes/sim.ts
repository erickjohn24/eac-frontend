import { Router } from "express";
import type { Request, Response } from "express";
import { db, getConfig, setConfig, resetAll } from "../db.js";
import { randomDigits } from "../util.js";
import { onBillPaid, completeBiometrics, completeInspection, completeVatVerification } from "../advance.js";

const router = Router();

// ---- reset / config --------------------------------------------------------
router.post("/reset", (_req, res) => {
  resetAll();
  res.json({ ok: true });
});

router.get("/config", (_req, res) => {
  res.json(getConfig());
});

router.post("/config", (req: Request, res: Response) => {
  res.json(setConfig(req.body ?? {}));
});

// ---- virtual inbox ---------------------------------------------------------
router.get("/messages", (req: Request, res: Response) => {
  const to = req.query.to ? String(req.query.to) : null;
  const rows = (
    to
      ? db.prepare("SELECT * FROM messages WHERE to_addr = ? ORDER BY id DESC").all(to.toLowerCase())
      : db.prepare("SELECT * FROM messages ORDER BY id DESC").all()
  ) as Record<string, any>[];
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

// ---- GePG ------------------------------------------------------------------
router.post("/gepg/pay/:controlNumber", (req: Request, res: Response) => {
  const bill = db.prepare("SELECT * FROM bills WHERE control_number = ?").get(req.params.controlNumber) as
    | Record<string, any>
    | undefined;
  if (!bill) {
    res.status(404).json({ error: "bill not found" });
    return;
  }
  let receiptNo = bill.receipt_no as string | null;
  if (bill.status !== "paid") {
    receiptNo = `RCP-${randomDigits(10)}`;
    db.prepare("UPDATE bills SET status = 'paid', receipt_no = ? WHERE control_number = ?").run(
      receiptNo,
      bill.control_number,
    );
    onBillPaid(bill.linked_kind, Number(bill.linked_id));
  }
  res.json({ status: "paid", receiptNo });
});

router.get("/gepg/bills/:controlNumber", (req: Request, res: Response) => {
  const bill = db.prepare("SELECT * FROM bills WHERE control_number = ?").get(req.params.controlNumber) as
    | Record<string, any>
    | undefined;
  if (!bill) {
    res.status(404).json({ error: "bill not found" });
    return;
  }
  res.json({
    controlNumber: bill.control_number,
    amountTzs: bill.amount_tzs,
    payee: bill.payee,
    description: bill.description,
    status: bill.status,
    ...(bill.receipt_no ? { receiptNo: bill.receipt_no } : {}),
  });
});

// ---- TRA biometrics / VAT verification -------------------------------------
router.post("/tra/biometrics/:appointmentRef", (req: Request, res: Response) => {
  const row = completeBiometrics(req.params.appointmentRef);
  if (!row) {
    res.status(404).json({ error: "appointment not found" });
    return;
  }
  res.json({ ok: true, status: "biometrics_completed" });
});

router.post("/tra/vat-verify/:id", (req: Request, res: Response) => {
  const row = completeVatVerification(Number(req.params.id));
  if (!row) {
    res.status(404).json({ error: "vat application not found" });
    return;
  }
  res.json({ ok: true, status: row.status, vrn: row.vrn });
});

// ---- OSHA inspection -------------------------------------------------------
router.post("/osha/inspect/:ref", (req: Request, res: Response) => {
  const row = completeInspection(req.params.ref);
  if (!row) {
    res.status(404).json({ error: "inspection not found" });
    return;
  }
  res.json({ ok: true, status: "inspection_completed" });
});

export default router;
