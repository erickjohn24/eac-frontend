import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "../db.js";

const PORTAL = "Government Electronic Payment Gateway";
const router = Router();

router.get("/bill/:controlNumber", (req: Request, res: Response) => {
  const row = db.prepare("SELECT * FROM bills WHERE control_number = ?").get(req.params.controlNumber) as
    | Record<string, any>
    | undefined;
  res.render("gepg/bill", {
    title: `Bill ${req.params.controlNumber} — ${PORTAL}`,
    portalName: PORTAL,
    controlNumber: req.params.controlNumber,
    row: row ?? null,
  });
});

export default router;
