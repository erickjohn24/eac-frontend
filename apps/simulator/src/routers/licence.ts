import { Router, type Request } from "express";
import multer from "multer";
import { db, createBill } from "./../db.js";
import { certificatePdf } from "./../pdf.js";

const upload = multer({ storage: multer.memoryStorage() });

export interface LicencePortalOpts {
  portal: "tnbp" | "tausi";
  portalName: string;
  payee: string;
  defaultAmount: number;
  authority: string;
  certificateTitle: string;
}

/** TNBP and TAUSI share the same licence-application shape. */
export function makeLicenceRouter(opts: LicencePortalOpts): Router {
  const router = Router();
  const base = `/${opts.portal}`;

  const locals = (_req: Request) => ({ portal: opts.portalName, userEmail: null, base });

  router.get("/", (req, res) => {
    res.redirect(`${base}/licence/apply`);
  });

  router.get("/licence/apply", (req, res) => {
    res.render("licence-form", { ...locals(req), title: `Business licence application — ${opts.portalName}` });
  });

  router.post(
    "/licence/apply",
    upload.fields([
      { name: "leaseAgreement", maxCount: 1 },
      { name: "tinCertificate", maxCount: 1 },
    ]),
    (req, res) => {
      const b = req.body as Record<string, string>;
      const info = db
        .prepare(
          `INSERT INTO licence_applications
           (portal, tin, incorporation_number, business_name, activity_code, premises_address, status)
           VALUES (?, ?, ?, ?, ?, ?, 'pending_payment')`,
        )
        .run(
          opts.portal,
          b.tin ?? "",
          b.incorporationNumber ?? "",
          b.businessName ?? "",
          b.activityCode ?? "",
          b.premisesAddress ?? "",
        );
      const id = Number(info.lastInsertRowid);
      const cn = createBill(
        opts.defaultAmount,
        opts.payee,
        `Business licence ${b.businessName ?? ""}`,
        "licence",
        id,
      );
      db.prepare("UPDATE licence_applications SET control_number = ? WHERE id = ?").run(cn, id);
      res.redirect(`${base}/licence/applications/${id}`);
    },
  );

  router.get("/licence/applications/:id", (req, res) => {
    const row = db
      .prepare("SELECT * FROM licence_applications WHERE id = ? AND portal = ?")
      .get(req.params.id, opts.portal) as Record<string, string> | undefined;
    if (!row) {
      res.status(404).send("Licence application not found");
      return;
    }
    res.render("licence-status", {
      ...locals(req),
      title: `Licence application LIC-${row.id} — ${opts.portalName}`,
      l: row,
    });
  });

  router.get("/licence/applications/:id/certificate.pdf", async (req, res) => {
    const row = db
      .prepare("SELECT * FROM licence_applications WHERE id = ? AND portal = ?")
      .get(req.params.id, opts.portal) as Record<string, string> | undefined;
    if (!row || row.status !== "issued") {
      res.status(404).send("Certificate not available");
      return;
    }
    const pdf = await certificatePdf({
      authority: opts.authority,
      title: opts.certificateTitle,
      entityName: row.business_name,
      number: row.licence_number,
      date: row.created_at,
    });
    res.type("application/pdf").send(pdf);
  });

  return router;
}
