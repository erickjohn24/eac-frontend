import { Router } from "express";
import { db } from "./../db.js";
import { certificatePdf } from "./../pdf.js";

export const oshaRouter = Router();
const PORTAL = "OSHA Workplace Information Management System (WIMS)";

const locals = () => ({ portal: PORTAL, userEmail: null });

oshaRouter.get("/", (_req, res) => {
  res.redirect("/osha/workplace/register");
});

oshaRouter.get("/workplace/register", (_req, res) => {
  res.render("osha-form", { ...locals(), title: `Workplace registration — ${PORTAL}` });
});

oshaRouter.post("/workplace/register", (req, res) => {
  const b = req.body as Record<string, string>;
  const info = db
    .prepare(
      `INSERT INTO osha_registrations
       (tin, company_name, workplace_address, employee_count, risk_category, status)
       VALUES (?, ?, ?, ?, ?, 'inspection_pending')`,
    )
    .run(b.tin ?? "", b.companyName ?? "", b.workplaceAddress ?? "", b.employeeCount ?? "", b.riskCategory ?? "");
  const id = Number(info.lastInsertRowid);
  db.prepare("UPDATE osha_registrations SET inspection_ref = ? WHERE id = ?").run(`INSP-${id}`, id);
  res.redirect(`/osha/workplace/applications/${id}`);
});

oshaRouter.get("/workplace/applications/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM osha_registrations WHERE id = ?").get(req.params.id) as
    | Record<string, string>
    | undefined;
  if (!row) {
    res.status(404).send("Workplace registration not found");
    return;
  }
  res.render("osha-status", { ...locals(), title: `Workplace registration ${row.id} — ${PORTAL}`, o: row });
});

oshaRouter.get("/workplace/applications/:id/certificate.pdf", async (req, res) => {
  const row = db.prepare("SELECT * FROM osha_registrations WHERE id = ?").get(req.params.id) as
    | Record<string, string>
    | undefined;
  if (!row || row.status !== "registered") {
    res.status(404).send("Certificate not available");
    return;
  }
  const pdf = await certificatePdf({
    authority: "Occupational Safety and Health Authority (OSHA)",
    title: "Certificate of Workplace Registration",
    entityName: row.company_name,
    number: row.osha_number,
    date: row.created_at,
  });
  res.type("application/pdf").send(pdf);
});
