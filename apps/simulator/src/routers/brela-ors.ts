import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { db, sendMessage, createBill } from "./../db.js";
import { makeCaptcha, checkCaptcha, nidaName, randomHex } from "./../util.js";
import { certificatePdf } from "./../pdf.js";

const upload = multer({ storage: multer.memoryStorage() });
export const brelaRouter = Router();

const PORTAL = "BRELA Online Registration System (ORS)";
const SEEDED_TAKEN = ["SAFARI TRADERS LIMITED", "KILIMANJARO HOLDINGS LIMITED"];

interface AccountRow {
  id: number;
  email: string;
  password: string;
  full_name: string | null;
  activated: number;
  activation_token: string | null;
}

function sessionEmail(req: Request): string | null {
  return (req.session as Record<string, string | undefined> | null)?.brela ?? null;
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!sessionEmail(req)) {
    res.redirect("/brela-ors/login");
    return;
  }
  next();
}

function baseLocals(req: Request) {
  return { portal: PORTAL, userEmail: sessionEmail(req) };
}

// ---- Landing ----
brelaRouter.get("/", (req, res) => {
  res.render("brela-home", { ...baseLocals(req), title: PORTAL });
});

// ---- Registration ----
function renderRegister(
  req: Request,
  res: Response,
  opts: { error?: string; values?: Record<string, string>; fullName?: string } = {},
): void {
  res.render("brela-register", {
    ...baseLocals(req),
    title: `Register — ${PORTAL}`,
    captcha: makeCaptcha(),
    error: opts.error ?? null,
    values: opts.values ?? {},
    fullName: opts.fullName ?? null,
  });
}

brelaRouter.get("/register", (req, res) => renderRegister(req, res));

brelaRouter.post("/nida-lookup", (req, res) => {
  const nin = String(req.body.nin ?? "").trim();
  if (nin.startsWith("9")) {
    renderRegister(req, res, { error: "NIN not found", values: { nin } });
    return;
  }
  if (!/^\d{20}$/.test(nin)) {
    renderRegister(req, res, { error: "NIN must be 20 digits", values: { nin } });
    return;
  }
  renderRegister(req, res, { values: { nin }, fullName: nidaName(nin) });
});

brelaRouter.post("/register", (req, res) => {
  const { nin, fullName, email, phone, password, captcha, captchaToken } = req.body as Record<string, string>;
  const values = { nin: nin ?? "", email: email ?? "", phone: phone ?? "" };
  if (!checkCaptcha(captchaToken, captcha)) {
    renderRegister(req, res, { error: "Incorrect CAPTCHA answer, please try again.", values, fullName });
    return;
  }
  if (!email || !password || !fullName) {
    renderRegister(req, res, { error: "All fields are required.", values, fullName });
    return;
  }
  const token = randomHex(16);
  db.prepare(
    "INSERT INTO accounts (portal, email, phone, password, full_name, nin, activation_token) VALUES ('brela', ?, ?, ?, ?, ?, ?)",
  ).run(email, phone ?? "", password, fullName, nin ?? "", token);
  const link = `/brela-ors/activate?token=${token}`;
  sendMessage(
    email,
    "email",
    "Activate your BRELA ORS account",
    `Dear ${fullName},\n\nActivate your BRELA ORS account by visiting: ${link}\n\nBRELA`,
  );
  res.render("brela-notice", {
    ...baseLocals(req),
    title: `Registration submitted — ${PORTAL}`,
    noticeId: null,
    heading: "Registration submitted",
    message: "Check your email for the activation link.",
  });
});

brelaRouter.get("/activate", (req, res) => {
  const token = String(req.query.token ?? "");
  const acct = db
    .prepare("SELECT * FROM accounts WHERE portal = 'brela' AND activation_token = ?")
    .get(token) as AccountRow | undefined;
  if (!acct) {
    res.status(400).render("brela-notice", {
      ...baseLocals(req),
      title: `Activation — ${PORTAL}`,
      noticeId: null,
      heading: "Activation failed",
      message: "Invalid or expired activation token.",
    });
    return;
  }
  db.prepare("UPDATE accounts SET activated = 1, activation_token = NULL WHERE id = ?").run(acct.id);
  res.render("brela-notice", {
    ...baseLocals(req),
    title: `Account activated — ${PORTAL}`,
    noticeId: "activated",
    heading: "Account activated",
    message: "Your account is now active. You may log in.",
  });
});

// ---- Login ----
brelaRouter.get("/login", (req, res) => {
  res.render("brela-login", { ...baseLocals(req), title: `Login — ${PORTAL}`, error: null });
});

brelaRouter.post("/login", (req, res) => {
  const { email, password } = req.body as Record<string, string>;
  const acct = db
    .prepare("SELECT * FROM accounts WHERE portal = 'brela' AND email = ? AND activated = 1")
    .get(email ?? "") as AccountRow | undefined;
  if (!acct || acct.password !== password) {
    res.status(401).render("brela-login", {
      ...baseLocals(req),
      title: `Login — ${PORTAL}`,
      error: "Invalid email or password.",
    });
    return;
  }
  (req.session as Record<string, unknown>).brela = acct.email;
  res.redirect("/brela-ors/");
});

// ---- Name search ----
brelaRouter.get("/name-search", (req, res) => {
  const q = String(req.query.q ?? "").trim();
  let status: string | null = null;
  if (q) {
    const upper = q.toUpperCase();
    const existing: string[] = [...SEEDED_TAKEN];
    for (const r of db.prepare("SELECT proposed_name FROM reservations").all() as { proposed_name: string }[]) {
      existing.push(r.proposed_name.toUpperCase());
    }
    for (const a of db.prepare("SELECT company_name FROM applications WHERE company_name IS NOT NULL").all() as {
      company_name: string;
    }[]) {
      existing.push(a.company_name.toUpperCase());
    }
    status = existing.some((name) => name && upper.includes(name)) ? "taken" : "available";
  }
  res.render("brela-name-search", { ...baseLocals(req), title: `Name search — ${PORTAL}`, q, status });
});

// ---- Name reservation ----
brelaRouter.get("/name-reservation", requireAuth, (req, res) => {
  res.render("brela-reservation-form", { ...baseLocals(req), title: `Name reservation — ${PORTAL}` });
});

brelaRouter.post("/name-reservation", requireAuth, (req, res) => {
  const { proposedName, entityType, natureOfBusiness } = req.body as Record<string, string>;
  const info = db
    .prepare(
      "INSERT INTO reservations (proposed_name, entity_type, nature_of_business, status) VALUES (?, ?, ?, 'pending_payment')",
    )
    .run(proposedName ?? "", entityType ?? "", natureOfBusiness ?? "");
  const id = Number(info.lastInsertRowid);
  const cn = createBill(50000, "BRELA", `Name reservation ${proposedName}`, "reservation", id);
  db.prepare("UPDATE reservations SET reservation_number = ?, control_number = ? WHERE id = ?").run(`RSV-${id}`, cn, id);
  res.redirect(`/brela-ors/reservations/${id}`);
});

brelaRouter.get("/reservations/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM reservations WHERE id = ?").get(req.params.id) as
    | Record<string, string>
    | undefined;
  if (!row) {
    res.status(404).send("Reservation not found");
    return;
  }
  res.render("brela-reservation", { ...baseLocals(req), title: `Reservation ${row.reservation_number} — ${PORTAL}`, r: row });
});

brelaRouter.get("/reservations/:id/certificate.pdf", async (req, res) => {
  const row = db.prepare("SELECT * FROM reservations WHERE id = ?").get(req.params.id) as
    | Record<string, string>
    | undefined;
  if (!row || row.status !== "reserved") {
    res.status(404).send("Certificate not available");
    return;
  }
  const pdf = await certificatePdf({
    authority: "Business Registrations and Licensing Agency (BRELA)",
    title: "Certificate of Name Reservation",
    entityName: row.proposed_name,
    number: row.reservation_number,
    date: row.created_at,
  });
  res.type("application/pdf").send(pdf);
});

// ---- TIN verify (used within incorporation form) ----
brelaRouter.post("/verify-tin", (req, res) => {
  const tin = String(req.body.tin ?? "");
  const nin = String(req.body.nin ?? "");
  if (tin.replace(/\D/g, "").startsWith("999")) {
    res.json({ valid: false });
    return;
  }
  res.json({ valid: true, name: nidaName(nin || tin) });
});

// ---- Incorporation ----
brelaRouter.get("/incorporation", requireAuth, (req, res) => {
  res.render("brela-incorporation-form", {
    ...baseLocals(req),
    title: `Company incorporation — ${PORTAL}`,
    error: null,
  });
});

brelaRouter.post(
  "/incorporation",
  requireAuth,
  upload.fields([
    { name: "memarts", maxCount: 1 },
    { name: "declaration", maxCount: 1 },
  ]),
  (req, res) => {
    const b = req.body as Record<string, string | string[]>;
    const asArray = (v: string | string[] | undefined): string[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
    const reservationNumber = String(b.reservationNumber ?? "").trim();
    const reservation = db
      .prepare("SELECT * FROM reservations WHERE reservation_number = ? AND status = 'reserved'")
      .get(reservationNumber) as { proposed_name: string } | undefined;
    if (!reservation) {
      res.status(400).render("brela-incorporation-form", {
        ...baseLocals(req),
        title: `Company incorporation — ${PORTAL}`,
        error: "Reservation number must refer to a reserved name.",
      });
      return;
    }
    const directors = asArray(b["director_fullName[]"] ?? b.director_fullName).map((name, i) => ({
      fullName: name,
      nin: asArray(b["director_nin[]"] ?? b.director_nin)[i] ?? "",
      tin: asArray(b["director_tin[]"] ?? b.director_tin)[i] ?? "",
    }));
    const shareholders = asArray(b["shareholder_fullName[]"] ?? b.shareholder_fullName).map((name, i) => ({
      fullName: name,
      nin: asArray(b["shareholder_nin[]"] ?? b.shareholder_nin)[i] ?? "",
      shares: asArray(b["shareholder_shares[]"] ?? b.shareholder_shares)[i] ?? "",
    }));
    const companyName = reservation.proposed_name;
    const info = db
      .prepare(
        `INSERT INTO applications
         (reservation_number, company_name, share_capital, total_shares, physical_address, region, district, directors, shareholders, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment')`,
      )
      .run(
        reservationNumber,
        companyName,
        String(b.shareCapital ?? ""),
        String(b.totalShares ?? ""),
        String(b.physicalAddress ?? ""),
        String(b.region ?? ""),
        String(b.district ?? ""),
        JSON.stringify(directors),
        JSON.stringify(shareholders),
      );
    const id = Number(info.lastInsertRowid);
    const cn = createBill(250000, "BRELA", `Company registration ${companyName}`, "application", id);
    db.prepare("UPDATE applications SET control_number = ? WHERE id = ?").run(cn, id);
    res.redirect(`/brela-ors/applications/${id}`);
  },
);

brelaRouter.get("/applications/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM applications WHERE id = ?").get(req.params.id) as
    | Record<string, string>
    | undefined;
  if (!row) {
    res.status(404).send("Application not found");
    return;
  }
  res.render("brela-application", { ...baseLocals(req), title: `Application APP-${row.id} — ${PORTAL}`, a: row });
});

brelaRouter.get("/applications/:id/certificate.pdf", async (req, res) => {
  const row = db.prepare("SELECT * FROM applications WHERE id = ?").get(req.params.id) as
    | Record<string, string>
    | undefined;
  if (!row || row.status !== "approved") {
    res.status(404).send("Certificate not available");
    return;
  }
  const pdf = await certificatePdf({
    authority: "Business Registrations and Licensing Agency (BRELA)",
    title: "Certificate of Incorporation",
    entityName: row.company_name,
    number: row.incorporation_number,
    date: row.incorporation_date,
  });
  res.type("application/pdf").send(pdf);
});
