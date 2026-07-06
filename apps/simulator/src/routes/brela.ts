import { Router } from "express";
import type { Request, Response } from "express";
import { db, sendMessage, createBill } from "../db.js";
import { makeCaptcha, checkCaptcha, nidaName, randomHex } from "../util.js";
import { currentAccount, requireAuth, upload } from "../web.js";
import { getReservation, getApplication } from "../advance.js";
import { generateCertificate } from "../certificates.js";

const PORTAL = "BRELA Online Registration System";
const router = Router();

const SEEDED_TAKEN = ["SAFARI TRADERS LIMITED", "KILIMANJARO HOLDINGS LIMITED"];

function auth() {
  return requireAuth("brela", "/brela-ors/login");
}

function isValidNin(nin: string): boolean {
  return /^\d{20}$/.test(nin) && !nin.startsWith("9");
}

function toArray(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (v === undefined || v === null) return [];
  return [v];
}

// ---- landing ---------------------------------------------------------------
router.get("/", (_req, res) => {
  res.render("brela/landing", { title: `${PORTAL}`, portalName: PORTAL });
});

// ---- registration ----------------------------------------------------------
function renderRegister(res: Response, extra: Record<string, unknown> = {}) {
  const captcha = makeCaptcha();
  res.render("brela/register", {
    title: `Register — ${PORTAL}`,
    portalName: PORTAL,
    captchaQuestion: captcha.question,
    captchaToken: captcha.token,
    nin: "",
    fullName: "",
    email: "",
    phone: "",
    error: null,
    ...extra,
  });
}

router.get("/register", (_req, res) => renderRegister(res));

router.post("/nida-lookup", (req: Request, res: Response) => {
  const nin = String(req.body.nin ?? "").trim();
  if (!isValidNin(nin)) {
    renderRegister(res, { nin, error: "NIN not found" });
    return;
  }
  renderRegister(res, { nin, fullName: nidaName(nin), email: req.body.email ?? "", phone: req.body.phone ?? "" });
});

router.post("/register", (req: Request, res: Response) => {
  const { nin = "", fullName = "", email = "", phone = "", password = "", captcha = "", captchaToken = "" } =
    req.body ?? {};
  if (!checkCaptcha(String(captchaToken), String(captcha))) {
    renderRegister(res, { nin, fullName, email, phone, error: "Incorrect CAPTCHA answer. Please try again." });
    return;
  }
  const token = randomHex(16);
  db.prepare(
    "INSERT INTO accounts (portal, email, phone, password, full_name, nin, activated, activation_token) VALUES ('brela', ?, ?, ?, ?, ?, 0, ?)",
  ).run(String(email).toLowerCase(), phone, password, fullName, nin, token);
  const link = `/brela-ors/activate?token=${token}`;
  sendMessage(
    String(email).toLowerCase(),
    "email",
    "Activate your BRELA ORS account",
    `Welcome to BRELA ORS. Activate your account: ${link}`,
  );
  res.render("notice", {
    title: `Check your email — ${PORTAL}`,
    portalName: PORTAL,
    heading: "Account created",
    notice: "Check your email to activate your account.",
    noticeId: null,
    links: [],
  });
});

router.get("/activate", (req: Request, res: Response) => {
  const token = String(req.query.token ?? "");
  const acc = db.prepare("SELECT * FROM accounts WHERE activation_token = ? AND portal = 'brela'").get(token) as
    | Record<string, any>
    | undefined;
  if (acc) db.prepare("UPDATE accounts SET activated = 1 WHERE id = ?").run(acc.id);
  res.render("notice", {
    title: `Account activated — ${PORTAL}`,
    portalName: PORTAL,
    heading: "Account activation",
    notice: acc ? "Your account is now active. You can log in." : "Invalid or expired activation link.",
    noticeId: acc ? "activated" : null,
    links: [{ href: "/brela-ors/login", text: "Continue to login", id: "login-link" }],
  });
});

// ---- login -----------------------------------------------------------------
router.get("/login", (_req, res) => {
  res.render("brela/login", { title: `Login — ${PORTAL}`, portalName: PORTAL, email: "", error: null });
});

router.post("/login", (req: Request, res: Response) => {
  const email = String(req.body.email ?? "").toLowerCase();
  const password = String(req.body.password ?? "");
  const acc = db
    .prepare("SELECT * FROM accounts WHERE portal = 'brela' AND email = ? AND password = ?")
    .get(email, password) as Record<string, any> | undefined;
  if (!acc) {
    res.render("brela/login", { title: `Login — ${PORTAL}`, portalName: PORTAL, email, error: "Invalid email or password." });
    return;
  }
  if (!acc.activated) {
    res.render("brela/login", {
      title: `Login — ${PORTAL}`,
      portalName: PORTAL,
      email,
      error: "Account not activated. Check your email for the activation link.",
    });
    return;
  }
  (req.session as Record<string, any>).brela = acc.id;
  res.redirect("/brela-ors/name-reservation");
});

// ---- name search (public) --------------------------------------------------
router.get("/name-search", (req: Request, res: Response) => {
  const q = String(req.query.q ?? "").trim();
  let status = "available";
  if (q) {
    const norm = q.toUpperCase();
    const existing = new Set<string>(SEEDED_TAKEN);
    for (const r of db.prepare("SELECT proposed_name FROM reservations WHERE status = 'reserved'").all() as {
      proposed_name: string;
    }[])
      if (r.proposed_name) existing.add(r.proposed_name.toUpperCase());
    for (const a of db.prepare("SELECT company_name FROM applications WHERE status = 'approved'").all() as {
      company_name: string;
    }[])
      if (a.company_name) existing.add(a.company_name.toUpperCase());
    for (const e of existing) {
      if (norm === e || norm.includes(e) || e.includes(norm)) {
        status = "taken";
        break;
      }
    }
  }
  res.render("brela/name-search", { title: `Name search — ${PORTAL}`, portalName: PORTAL, q, status });
});

// ---- name reservation ------------------------------------------------------
router.get("/name-reservation", auth(), (_req, res) => {
  res.render("brela/reservation-form", {
    title: `Name reservation — ${PORTAL}`,
    portalName: PORTAL,
    proposedName: "",
    natureOfBusiness: "",
    error: null,
  });
});

router.post("/name-reservation", auth(), (req: Request, res: Response) => {
  const acc = currentAccount(req, "brela")!;
  const proposedName = String(req.body.proposedName ?? "").trim();
  const entityType = String(req.body.entityType ?? "private_company");
  const natureOfBusiness = String(req.body.natureOfBusiness ?? "");
  if (!proposedName) {
    res.render("brela/reservation-form", {
      title: `Name reservation — ${PORTAL}`,
      portalName: PORTAL,
      proposedName,
      natureOfBusiness,
      error: "Proposed name is required.",
    });
    return;
  }
  const info = db
    .prepare(
      "INSERT INTO reservations (account_id, proposed_name, entity_type, nature_of_business, status) VALUES (?, ?, ?, ?, 'pending_payment')",
    )
    .run(acc.id, proposedName, entityType, natureOfBusiness);
  const id = Number(info.lastInsertRowid);
  const control = createBill(50000, "BRELA", `Name reservation ${proposedName}`, "reservation", id);
  db.prepare("UPDATE reservations SET control_number = ? WHERE id = ?").run(control, id);
  res.redirect(`/brela-ors/reservations/${id}`);
});

router.get("/reservations/:id", auth(), (req: Request, res: Response) => {
  const row = getReservation(Number(req.params.id));
  if (!row) {
    res.status(404).send("Reservation not found");
    return;
  }
  res.render("brela/reservation-status", {
    title: `Reservation ${row.reservation_number ?? row.id} — ${PORTAL}`,
    portalName: PORTAL,
    userEmail: currentAccount(req, "brela")?.email ?? null,
    row,
  });
});

router.get("/reservations/:id/certificate.pdf", auth(), (req: Request, res: Response) => {
  const row = getReservation(Number(req.params.id));
  if (!row || row.status !== "reserved") {
    res.status(404).send("Certificate not available");
    return;
  }
  generateCertificate(res, {
    portal: PORTAL,
    title: "Certificate of Name Reservation",
    entityName: row.proposed_name,
    number: row.reservation_number,
    date: new Date().toISOString().slice(0, 10),
  });
});

// ---- incorporation ---------------------------------------------------------
router.get("/incorporation", auth(), (_req, res) => {
  res.render("brela/incorporation-form", {
    title: `Incorporation — ${PORTAL}`,
    portalName: PORTAL,
    reservationNumber: "",
    error: null,
  });
});

router.post("/verify-tin", (req: Request, res: Response) => {
  const tin = String(req.body.tin ?? "").trim();
  const nin = String(req.body.nin ?? "").trim();
  const valid = tin.length > 0 && !tin.startsWith("999");
  res.json(valid ? { valid: true, name: nidaName(nin || tin) } : { valid: false });
});

router.post(
  "/incorporation",
  auth(),
  upload.fields([
    { name: "memarts", maxCount: 1 },
    { name: "declaration", maxCount: 1 },
  ]),
  (req: Request, res: Response) => {
    const acc = currentAccount(req, "brela")!;
    const reservationNumber = String(req.body.reservationNumber ?? "").trim();
    const reservation = db
      .prepare("SELECT * FROM reservations WHERE reservation_number = ? AND status = 'reserved'")
      .get(reservationNumber) as Record<string, any> | undefined;
    if (!reservation) {
      res.render("brela/incorporation-form", {
        title: `Incorporation — ${PORTAL}`,
        portalName: PORTAL,
        reservationNumber,
        error: "A valid, reserved name reservation number is required.",
      });
      return;
    }
    const directors = JSON.stringify({
      fullName: toArray(req.body["director_fullName[]"]),
      nin: toArray(req.body["director_nin[]"]),
      tin: toArray(req.body["director_tin[]"]),
    });
    const shareholders = JSON.stringify({
      fullName: toArray(req.body["shareholder_fullName[]"]),
      nin: toArray(req.body["shareholder_nin[]"]),
      shares: toArray(req.body["shareholder_shares[]"]),
    });
    const info = db
      .prepare(
        `INSERT INTO applications
          (account_id, reservation_number, company_name, share_capital, total_shares, physical_address, region, district, directors, shareholders, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment')`,
      )
      .run(
        acc.id,
        reservationNumber,
        reservation.proposed_name,
        req.body.shareCapital ?? "",
        req.body.totalShares ?? "",
        req.body.physicalAddress ?? "",
        req.body.region ?? "",
        req.body.district ?? "",
        directors,
        shareholders,
      );
    const id = Number(info.lastInsertRowid);
    const control = createBill(250000, "BRELA", `Company registration ${reservation.proposed_name}`, "application", id);
    db.prepare("UPDATE applications SET control_number = ? WHERE id = ?").run(control, id);
    res.redirect(`/brela-ors/applications/${id}`);
  },
);

router.get("/applications/:id", auth(), (req: Request, res: Response) => {
  const row = getApplication(Number(req.params.id));
  if (!row) {
    res.status(404).send("Application not found");
    return;
  }
  res.render("brela/application-status", {
    title: `Application ${row.id} — ${PORTAL}`,
    portalName: PORTAL,
    userEmail: currentAccount(req, "brela")?.email ?? null,
    row,
  });
});

router.get("/applications/:id/certificate.pdf", auth(), (req: Request, res: Response) => {
  const row = getApplication(Number(req.params.id));
  if (!row || row.status !== "approved") {
    res.status(404).send("Certificate not available");
    return;
  }
  generateCertificate(res, {
    portal: PORTAL,
    title: "Certificate of Incorporation",
    entityName: row.company_name,
    number: row.incorporation_number,
    date: row.incorporation_date,
  });
});

export default router;
