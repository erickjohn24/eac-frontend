import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "../db.js";
import { getEmployer, getOsha, scheduleEmployer, inspectionRef } from "../advance.js";
import { generateCertificate } from "../certificates.js";

export interface EmployerConfig {
  portal: "nssf" | "wcf";
  portalName: string;
  base: string;
  formId: string;
  statusId: string;
  numberId: string;
  certId: string;
}

export function employerRouter(cfg: EmployerConfig): Router {
  const router = Router();
  const PORTAL = cfg.portalName;

  router.get("/employer/register", (_req, res) => {
    res.render("social/employer-form", {
      title: `Employer registration — ${PORTAL}`,
      portalName: PORTAL,
      heading: `${PORTAL} — employer registration`,
      formId: cfg.formId,
      action: `${cfg.base}/employer/register`,
      tin: "",
      companyName: "",
      incorporationNumber: "",
      error: null,
    });
  });

  router.post("/employer/register", (req: Request, res: Response) => {
    const info = db
      .prepare(
        `INSERT INTO employer_registrations
          (portal, tin, company_name, incorporation_number, employee_count, contact_email, status)
         VALUES (?, ?, ?, ?, ?, ?, 'processing')`,
      )
      .run(
        cfg.portal,
        req.body.tin ?? "",
        req.body.companyName ?? "",
        req.body.incorporationNumber ?? "",
        req.body.employeeCount ?? "",
        req.body.contactEmail ?? "",
      );
    const id = Number(info.lastInsertRowid);
    scheduleEmployer(id);
    res.redirect(`${cfg.base}/employer/applications/${id}`);
  });

  router.get("/employer/applications/:id", (req: Request, res: Response) => {
    const row = getEmployer(Number(req.params.id));
    if (!row || row.portal !== cfg.portal) {
      res.status(404).send("Application not found");
      return;
    }
    res.render("social/employer-status", {
      title: `${PORTAL} registration ${row.id}`,
      portalName: PORTAL,
      heading: `${PORTAL} — employer registration`,
      row,
      statusId: cfg.statusId,
      numberId: cfg.numberId,
      certId: cfg.certId,
      certHref: `${cfg.base}/employer/applications/${row.id}/certificate.pdf`,
    });
  });

  router.get("/employer/applications/:id/certificate.pdf", (req: Request, res: Response) => {
    const row = getEmployer(Number(req.params.id));
    if (!row || row.portal !== cfg.portal || row.status !== "registered") {
      res.status(404).send("Certificate not available");
      return;
    }
    generateCertificate(res, {
      portal: PORTAL,
      title: `${cfg.portal.toUpperCase()} Employer Registration Certificate`,
      entityName: row.company_name,
      number: row.reg_number,
      date: new Date().toISOString().slice(0, 10),
    });
  });

  return router;
}

export function oshaRouter(): Router {
  const router = Router();
  const PORTAL = "OSHA WIMS";

  router.get("/workplace/register", (_req, res) => {
    res.render("osha/form", {
      title: `Workplace registration — ${PORTAL}`,
      portalName: PORTAL,
      tin: "",
      companyName: "",
      error: null,
    });
  });

  router.post("/workplace/register", (req: Request, res: Response) => {
    const info = db
      .prepare(
        `INSERT INTO osha_registrations
          (tin, company_name, workplace_address, employee_count, risk_category, status, inspection_ref)
         VALUES (?, ?, ?, ?, ?, 'inspection_pending', '')`,
      )
      .run(
        req.body.tin ?? "",
        req.body.companyName ?? "",
        req.body.workplaceAddress ?? "",
        req.body.employeeCount ?? "",
        req.body.riskCategory ?? "low",
      );
    const id = Number(info.lastInsertRowid);
    db.prepare("UPDATE osha_registrations SET inspection_ref = ? WHERE id = ?").run(inspectionRef(id), id);
    res.redirect(`/osha/workplace/applications/${id}`);
  });

  router.get("/workplace/applications/:id", (req: Request, res: Response) => {
    const row = getOsha(Number(req.params.id));
    if (!row) {
      res.status(404).send("Application not found");
      return;
    }
    res.render("osha/status", { title: `OSHA registration ${row.id}`, portalName: PORTAL, row });
  });

  router.get("/workplace/applications/:id/certificate.pdf", (req: Request, res: Response) => {
    const row = getOsha(Number(req.params.id));
    if (!row || row.status !== "registered") {
      res.status(404).send("Certificate not available");
      return;
    }
    generateCertificate(res, {
      portal: PORTAL,
      title: "OSHA Workplace Registration Certificate",
      entityName: row.company_name,
      number: row.osha_number,
      date: new Date().toISOString().slice(0, 10),
    });
  });

  return router;
}
