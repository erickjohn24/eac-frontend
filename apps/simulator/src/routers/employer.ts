import { Router, type Request } from "express";
import { db } from "./../db.js";
import { scheduleAdvance } from "./../scheduler.js";
import { certificatePdf } from "./../pdf.js";

export interface EmployerPortalOpts {
  portal: "nssf" | "wcf";
  portalName: string;
  authority: string;
  certificateTitle: string;
}

/** NSSF and WCF share the same employer-registration shape. */
export function makeEmployerRouter(opts: EmployerPortalOpts): Router {
  const router = Router();
  const base = `/${opts.portal}`;

  const locals = (_req: Request) => ({ portal: opts.portalName, userEmail: null, base, key: opts.portal });

  router.get("/", (req, res) => {
    res.redirect(`${base}/employer/register`);
  });

  router.get("/employer/register", (req, res) => {
    res.render("employer-form", { ...locals(req), title: `Employer registration — ${opts.portalName}` });
  });

  router.post("/employer/register", (req, res) => {
    const b = req.body as Record<string, string>;
    const info = db
      .prepare(
        `INSERT INTO employer_registrations
         (portal, tin, company_name, incorporation_number, employee_count, contact_email, status)
         VALUES (?, ?, ?, ?, ?, ?, 'processing')`,
      )
      .run(opts.portal, b.tin ?? "", b.companyName ?? "", b.incorporationNumber ?? "", b.employeeCount ?? "", b.contactEmail ?? "");
    const id = Number(info.lastInsertRowid);
    scheduleAdvance("employer", id);
    res.redirect(`${base}/employer/applications/${id}`);
  });

  router.get("/employer/applications/:id", (req, res) => {
    const row = db
      .prepare("SELECT * FROM employer_registrations WHERE id = ? AND portal = ?")
      .get(req.params.id, opts.portal) as Record<string, string> | undefined;
    if (!row) {
      res.status(404).send("Registration not found");
      return;
    }
    res.render("employer-status", {
      ...locals(req),
      title: `Employer registration ${row.id} — ${opts.portalName}`,
      e: row,
    });
  });

  router.get("/employer/applications/:id/certificate.pdf", async (req, res) => {
    const row = db
      .prepare("SELECT * FROM employer_registrations WHERE id = ? AND portal = ?")
      .get(req.params.id, opts.portal) as Record<string, string> | undefined;
    if (!row || row.status !== "registered") {
      res.status(404).send("Certificate not available");
      return;
    }
    const pdf = await certificatePdf({
      authority: opts.authority,
      title: opts.certificateTitle,
      entityName: row.company_name,
      number: row.reg_number,
      date: row.created_at,
    });
    res.type("application/pdf").send(pdf);
  });

  return router;
}
