import { Router } from "express";
import type { Request, Response } from "express";
import { db, sendMessage } from "../db.js";
import { makeOtp, nowMs } from "../util.js";
import { currentAccount, requireAuth } from "../web.js";
import { getTin, getVat, appointmentRef } from "../advance.js";
import { generateCertificate } from "../certificates.js";

const PORTAL = "TRA Taxpayer Portal";
const OTP_TTL_MS = 15 * 60 * 1000;
const router = Router();

function auth() {
  return requireAuth("tra", "/tra/login");
}

// ---- landing ---------------------------------------------------------------
router.get("/", (_req, res) => {
  res.render("tra/landing", { title: PORTAL, portalName: PORTAL });
});

// ---- registration + OTP ----------------------------------------------------
router.get("/register", (_req, res) => {
  res.render("tra/register", { title: `Register — ${PORTAL}`, portalName: PORTAL, email: "", phone: "", error: null });
});

router.post("/register", (req: Request, res: Response) => {
  const email = String(req.body.email ?? "").toLowerCase();
  const phone = String(req.body.phone ?? "");
  const password = String(req.body.password ?? "");
  const otp = makeOtp();
  const expires = nowMs() + OTP_TTL_MS;
  db.prepare(
    "INSERT INTO accounts (portal, email, phone, password, activated, otp, otp_expires_at) VALUES ('tra', ?, ?, ?, 0, ?, ?)",
  ).run(email, phone, password, otp, expires);
  sendMessage(email, "email", "TRA verification code", `Your TRA verification code is ${otp}. It expires in 15 minutes.`);
  res.render("tra/otp", { title: `Verify — ${PORTAL}`, portalName: PORTAL, email, error: null });
});

router.post("/verify-otp", (req: Request, res: Response) => {
  const email = String(req.body.email ?? "").toLowerCase();
  const otp = String(req.body.otp ?? "").trim();
  const acc = db
    .prepare("SELECT * FROM accounts WHERE portal = 'tra' AND email = ? ORDER BY id DESC")
    .get(email) as Record<string, any> | undefined;
  if (!acc || acc.otp !== otp || !acc.otp_expires_at || nowMs() > Number(acc.otp_expires_at)) {
    res.render("tra/otp", { title: `Verify — ${PORTAL}`, portalName: PORTAL, email, error: "Invalid or expired code." });
    return;
  }
  db.prepare("UPDATE accounts SET activated = 1, otp = NULL WHERE id = ?").run(acc.id);
  (req.session as Record<string, any>).tra = acc.id;
  res.redirect("/tra/tin/company");
});

// ---- login -----------------------------------------------------------------
router.get("/login", (_req, res) => {
  res.render("tra/login", { title: `Login — ${PORTAL}`, portalName: PORTAL, email: "", error: null });
});

router.post("/login", (req: Request, res: Response) => {
  const email = String(req.body.email ?? "").toLowerCase();
  const password = String(req.body.password ?? "");
  const acc = db
    .prepare("SELECT * FROM accounts WHERE portal = 'tra' AND email = ? AND password = ? AND activated = 1")
    .get(email, password) as Record<string, any> | undefined;
  if (!acc) {
    res.render("tra/login", { title: `Login — ${PORTAL}`, portalName: PORTAL, email, error: "Invalid credentials or unverified account." });
    return;
  }
  (req.session as Record<string, any>).tra = acc.id;
  res.redirect("/tra/tin/company");
});

// ---- company TIN -----------------------------------------------------------
router.get("/tin/company", auth(), (_req, res) => {
  res.render("tra/tin-form", {
    title: `Company TIN — ${PORTAL}`,
    portalName: PORTAL,
    incorporationNumber: "",
    companyName: "",
    error: null,
  });
});

router.post("/tin/company", auth(), (req: Request, res: Response) => {
  const acc = currentAccount(req, "tra")!;
  const info = db
    .prepare(
      `INSERT INTO tin_applications
        (account_id, incorporation_number, company_name, physical_address, region, business_sector, rep_full_name, rep_nin, rep_tin, status, appointment_ref, appointment_location, biometrics_done)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'biometrics_pending', '', 'TRA Ilala Tax Region Office', 0)`,
    )
    .run(
      acc.id,
      req.body.incorporationNumber ?? "",
      req.body.companyName ?? "",
      req.body.physicalAddress ?? "",
      req.body.region ?? "",
      req.body.businessSector ?? "",
      req.body.repFullName ?? "",
      req.body.repNin ?? "",
      req.body.repTin ?? "",
    );
  const id = Number(info.lastInsertRowid);
  db.prepare("UPDATE tin_applications SET appointment_ref = ? WHERE id = ?").run(appointmentRef(id), id);
  res.redirect(`/tra/tin/applications/${id}`);
});

router.get("/tin/applications/:id", auth(), (req: Request, res: Response) => {
  const row = getTin(Number(req.params.id));
  if (!row) {
    res.status(404).send("Application not found");
    return;
  }
  res.render("tra/tin-status", {
    title: `TIN application ${row.id} — ${PORTAL}`,
    portalName: PORTAL,
    userEmail: currentAccount(req, "tra")?.email ?? null,
    row,
  });
});

router.get("/tin/applications/:id/certificate.pdf", auth(), (req: Request, res: Response) => {
  const row = getTin(Number(req.params.id));
  if (!row || row.status !== "issued") {
    res.status(404).send("Certificate not available");
    return;
  }
  generateCertificate(res, {
    portal: PORTAL,
    title: "Taxpayer Identification Number Certificate",
    entityName: row.company_name,
    number: row.tin,
    date: new Date().toISOString().slice(0, 10),
  });
});

// ---- VAT -------------------------------------------------------------------
router.get("/vat/apply", auth(), (_req, res) => {
  res.render("tra/vat-form", { title: `VAT registration — ${PORTAL}`, portalName: PORTAL, tin: "", error: null });
});

router.post("/vat/apply", auth(), (req: Request, res: Response) => {
  const acc = currentAccount(req, "tra")!;
  const info = db
    .prepare(
      "INSERT INTO vat_applications (account_id, tin, expected_turnover, business_description, status) VALUES (?, ?, ?, ?, 'verification_pending')",
    )
    .run(acc.id, req.body.tin ?? "", req.body.expectedTurnover ?? "", req.body.businessDescription ?? "");
  res.redirect(`/tra/vat/applications/${Number(info.lastInsertRowid)}`);
});

router.get("/vat/applications/:id", auth(), (req: Request, res: Response) => {
  const row = getVat(Number(req.params.id));
  if (!row) {
    res.status(404).send("Application not found");
    return;
  }
  res.render("tra/vat-status", {
    title: `VAT application ${row.id} — ${PORTAL}`,
    portalName: PORTAL,
    userEmail: currentAccount(req, "tra")?.email ?? null,
    row,
  });
});

router.get("/vat/applications/:id/certificate.pdf", auth(), (req: Request, res: Response) => {
  const row = getVat(Number(req.params.id));
  if (!row || row.status !== "registered") {
    res.status(404).send("Certificate not available");
    return;
  }
  generateCertificate(res, {
    portal: PORTAL,
    title: "VAT Registration Certificate",
    entityName: row.tin,
    number: row.vrn,
    date: new Date().toISOString().slice(0, 10),
  });
});

export default router;
