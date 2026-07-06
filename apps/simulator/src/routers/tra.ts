import { Router, type Request, type Response, type NextFunction } from "express";
import { db, sendMessage } from "./../db.js";
import { makeOtp, randomDigits } from "./../util.js";
import { certificatePdf } from "./../pdf.js";

export const traRouter = Router();
const PORTAL = "TRA Taxpayer Portal";
const OTP_TTL_MS = 15 * 60 * 1000;

interface AccountRow {
  id: number;
  email: string;
  password: string;
  activated: number;
  otp: string | null;
  otp_expires_at: number | null;
}

function sessionEmail(req: Request): string | null {
  return (req.session as Record<string, string | undefined> | null)?.tra ?? null;
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!sessionEmail(req)) {
    res.redirect("/tra/login");
    return;
  }
  next();
}

function baseLocals(req: Request) {
  return { portal: PORTAL, userEmail: sessionEmail(req) };
}

traRouter.get("/", (req, res) => {
  res.render("tra-home", { ...baseLocals(req), title: PORTAL });
});

// ---- Registration + OTP ----
traRouter.get("/register", (req, res) => {
  res.render("tra-register", { ...baseLocals(req), title: `Register — ${PORTAL}`, error: null });
});

traRouter.post("/register", (req, res) => {
  const { email, phone, password } = req.body as Record<string, string>;
  if (!email || !password) {
    res.status(400).render("tra-register", {
      ...baseLocals(req),
      title: `Register — ${PORTAL}`,
      error: "Email and password are required.",
    });
    return;
  }
  const otp = makeOtp();
  const expires = Date.now() + OTP_TTL_MS;
  const existing = db.prepare("SELECT id FROM accounts WHERE portal = 'tra' AND email = ?").get(email) as
    | { id: number }
    | undefined;
  if (existing) {
    db.prepare("UPDATE accounts SET phone = ?, password = ?, otp = ?, otp_expires_at = ? WHERE id = ?").run(
      phone ?? "",
      password,
      otp,
      expires,
      existing.id,
    );
  } else {
    db.prepare(
      "INSERT INTO accounts (portal, email, phone, password, otp, otp_expires_at) VALUES ('tra', ?, ?, ?, ?, ?)",
    ).run(email, phone ?? "", password, otp, expires);
  }
  sendMessage(email, "email", "TRA verification code", `Your TRA verification code is ${otp}. It expires in 15 minutes.`);
  res.render("tra-otp", { ...baseLocals(req), title: `Verify OTP — ${PORTAL}`, email, error: null });
});

traRouter.post("/verify-otp", (req, res) => {
  const { email, otp } = req.body as Record<string, string>;
  const acct = db.prepare("SELECT * FROM accounts WHERE portal = 'tra' AND email = ?").get(email ?? "") as
    | AccountRow
    | undefined;
  const valid =
    acct && acct.otp && acct.otp === String(otp ?? "").trim() && (acct.otp_expires_at ?? 0) > Date.now();
  if (!valid) {
    res.status(400).render("tra-otp", {
      ...baseLocals(req),
      title: `Verify OTP — ${PORTAL}`,
      email: email ?? "",
      error: "Invalid or expired verification code.",
    });
    return;
  }
  db.prepare("UPDATE accounts SET activated = 1, otp = NULL, otp_expires_at = NULL WHERE id = ?").run(acct.id);
  (req.session as Record<string, unknown>).tra = acct.email;
  res.redirect("/tra/");
});

// ---- Login ----
traRouter.get("/login", (req, res) => {
  res.render("tra-login", { ...baseLocals(req), title: `Login — ${PORTAL}`, error: null });
});

traRouter.post("/login", (req, res) => {
  const { email, password } = req.body as Record<string, string>;
  const acct = db
    .prepare("SELECT * FROM accounts WHERE portal = 'tra' AND email = ? AND activated = 1")
    .get(email ?? "") as AccountRow | undefined;
  if (!acct || acct.password !== password) {
    res.status(401).render("tra-login", {
      ...baseLocals(req),
      title: `Login — ${PORTAL}`,
      error: "Invalid email or password.",
    });
    return;
  }
  (req.session as Record<string, unknown>).tra = acct.email;
  res.redirect("/tra/");
});

// ---- Company TIN ----
traRouter.get("/tin/company", requireAuth, (req, res) => {
  res.render("tra-tin-form", { ...baseLocals(req), title: `Company TIN application — ${PORTAL}` });
});

traRouter.post("/tin/company", requireAuth, (req, res) => {
  const b = req.body as Record<string, string>;
  const info = db
    .prepare(
      `INSERT INTO tin_applications
       (incorporation_number, company_name, physical_address, region, business_sector, rep_full_name, rep_nin, rep_tin, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'biometrics_pending')`,
    )
    .run(
      b.incorporationNumber ?? "",
      b.companyName ?? "",
      b.physicalAddress ?? "",
      b.region ?? "",
      b.businessSector ?? "",
      b.repFullName ?? "",
      b.repNin ?? "",
      b.repTin ?? "",
    );
  const id = Number(info.lastInsertRowid);
  db.prepare("UPDATE tin_applications SET appointment_ref = ? WHERE id = ?").run(`BIO-${id}`, id);
  res.redirect(`/tra/tin/applications/${id}`);
});

traRouter.get("/tin/applications/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM tin_applications WHERE id = ?").get(req.params.id) as
    | Record<string, string>
    | undefined;
  if (!row) {
    res.status(404).send("TIN application not found");
    return;
  }
  res.render("tra-tin-status", { ...baseLocals(req), title: `TIN application TINAPP-${row.id} — ${PORTAL}`, t: row });
});

traRouter.get("/tin/applications/:id/certificate.pdf", async (req, res) => {
  const row = db.prepare("SELECT * FROM tin_applications WHERE id = ?").get(req.params.id) as
    | Record<string, string>
    | undefined;
  if (!row || row.status !== "issued") {
    res.status(404).send("Certificate not available");
    return;
  }
  const pdf = await certificatePdf({
    authority: "Tanzania Revenue Authority (TRA)",
    title: "Taxpayer Identification Number Certificate",
    entityName: row.company_name,
    number: row.tin,
    date: row.created_at,
  });
  res.type("application/pdf").send(pdf);
});

// ---- VAT ----
traRouter.get("/vat/apply", requireAuth, (req, res) => {
  res.render("tra-vat-form", { ...baseLocals(req), title: `VAT registration — ${PORTAL}` });
});

traRouter.post("/vat/apply", requireAuth, (req, res) => {
  const b = req.body as Record<string, string>;
  const info = db
    .prepare(
      "INSERT INTO vat_applications (tin, expected_turnover, business_description, status) VALUES (?, ?, ?, 'verification_pending')",
    )
    .run(b.tin ?? "", b.expectedTurnover ?? "", b.businessDescription ?? "");
  res.redirect(`/tra/vat/applications/${Number(info.lastInsertRowid)}`);
});

traRouter.get("/vat/applications/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM vat_applications WHERE id = ?").get(req.params.id) as
    | Record<string, string>
    | undefined;
  if (!row) {
    res.status(404).send("VAT application not found");
    return;
  }
  res.render("tra-vat-status", { ...baseLocals(req), title: `VAT application ${row.id} — ${PORTAL}`, v: row });
});

/** Generates a VRN like 40-123456-W. */
export function makeVrn(): string {
  return `40-${randomDigits(6)}-W`;
}
