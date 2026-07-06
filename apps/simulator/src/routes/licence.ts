import { Router } from "express";
import type { Request, Response } from "express";
import { db, createBill } from "../db.js";
import { upload } from "../web.js";
import { getLicence } from "../advance.js";
import { generateCertificate } from "../certificates.js";

export interface LicenceConfig {
  portal: "tnbp" | "tausi";
  portalName: string;
  base: string; // e.g. "/tnbp"
  payee: string;
  amount: number;
}

export function licenceRouter(cfg: LicenceConfig): Router {
  const router = Router();
  const PORTAL = cfg.portalName;

  router.get("/licence/apply", (_req, res) => {
    res.render("licence/form", {
      title: `Business licence — ${PORTAL}`,
      portalName: PORTAL,
      heading: "Business licence application",
      action: `${cfg.base}/licence/apply`,
      tin: "",
      incorporationNumber: "",
      businessName: "",
      error: null,
    });
  });

  router.post(
    "/licence/apply",
    upload.fields([
      { name: "leaseAgreement", maxCount: 1 },
      { name: "tinCertificate", maxCount: 1 },
    ]),
    (req: Request, res: Response) => {
      const businessName = String(req.body.businessName ?? "").trim();
      const info = db
        .prepare(
          `INSERT INTO licence_applications
            (portal, tin, incorporation_number, business_name, activity_code, premises_address, status)
           VALUES (?, ?, ?, ?, ?, ?, 'pending_payment')`,
        )
        .run(
          cfg.portal,
          req.body.tin ?? "",
          req.body.incorporationNumber ?? "",
          businessName,
          req.body.activityCode ?? "",
          req.body.premisesAddress ?? "",
        );
      const id = Number(info.lastInsertRowid);
      const control = createBill(cfg.amount, cfg.payee, `Business licence ${businessName}`, "licence", id);
      db.prepare("UPDATE licence_applications SET control_number = ? WHERE id = ?").run(control, id);
      res.redirect(`${cfg.base}/licence/applications/${id}`);
    },
  );

  router.get("/licence/applications/:id", (req: Request, res: Response) => {
    const row = getLicence(Number(req.params.id));
    if (!row || row.portal !== cfg.portal) {
      res.status(404).send("Application not found");
      return;
    }
    res.render("licence/status", {
      title: `Licence ${row.id} — ${PORTAL}`,
      portalName: PORTAL,
      row,
      certHref: `${cfg.base}/licence/applications/${row.id}/certificate.pdf`,
    });
  });

  router.get("/licence/applications/:id/certificate.pdf", (req: Request, res: Response) => {
    const row = getLicence(Number(req.params.id));
    if (!row || row.portal !== cfg.portal || row.status !== "issued") {
      res.status(404).send("Certificate not available");
      return;
    }
    generateCertificate(res, {
      portal: PORTAL,
      title: "Business Licence",
      entityName: row.business_name,
      number: row.licence_number,
      date: new Date().toISOString().slice(0, 10),
    });
  });

  return router;
}
