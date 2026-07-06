import { Router } from "express";
import { db } from "./../db.js";

export const gepgRouter = Router();
const PORTAL = "Government Electronic Payment Gateway (GePG)";

gepgRouter.get("/bill/:controlNumber", (req, res) => {
  const bill = db.prepare("SELECT * FROM bills WHERE control_number = ?").get(req.params.controlNumber) as
    | Record<string, string>
    | undefined;
  if (!bill) {
    res.status(404).send("Bill not found");
    return;
  }
  res.render("gepg-bill", {
    portal: PORTAL,
    userEmail: null,
    title: `Bill ${bill.control_number} — ${PORTAL}`,
    bill,
  });
});
