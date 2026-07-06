import express from "express";
import type { Request, Response, NextFunction } from "express";
import cookieSession from "cookie-session";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getConfig } from "./db.js";
import simRouter from "./routes/sim.js";
import brelaRouter from "./routes/brela.js";
import traRouter from "./routes/tra.js";
import gepgRouter from "./routes/gepg.js";
import { licenceRouter } from "./routes/licence.js";
import { employerRouter, oshaRouter } from "./routes/social.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(here, "views"));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieSession({ name: "sim", secret: "sim", maxAge: 24 * 60 * 60 * 1000 }));

// Response-local defaults so every EJS template has the vars it references.
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.locals.userEmail = null;
  res.locals.error = null;
  res.locals.notice = null;
  res.locals.noticeId = null;
  res.locals.portalName = "";
  res.locals.title = "Portal Simulator";
  next();
});

// test/ops endpoints (no auth, exempt from simulated latency/failures)
app.use("/_sim", simRouter);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Simulated chaos: latencyMs delays every response; failureRate returns random 500s.
// Skipped for /_sim so tests can always control state.
app.use(async (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith("/_sim")) {
    next();
    return;
  }
  const cfg = getConfig();
  if (cfg.latencyMs > 0) await sleep(cfg.latencyMs);
  if (cfg.failureRate > 0 && Math.random() < cfg.failureRate) {
    res.status(500).send("Simulated server error");
    return;
  }
  next();
});

app.use("/brela-ors", brelaRouter);
app.use("/tra", traRouter);
app.use("/gepg", gepgRouter);
app.use(
  "/tnbp",
  licenceRouter({
    portal: "tnbp",
    portalName: "Tanzania National Business Portal",
    base: "/tnbp",
    payee: "MIT",
    amount: 150000,
  }),
);
app.use(
  "/tausi",
  licenceRouter({
    portal: "tausi",
    portalName: "TAUSI Local Government Portal",
    base: "/tausi",
    payee: "LGA",
    amount: 80000,
  }),
);
app.use(
  "/nssf",
  employerRouter({
    portal: "nssf",
    portalName: "NSSF Employer Portal",
    base: "/nssf",
    formId: "nssf-form",
    statusId: "nssf-status",
    numberId: "nssf-number",
    certId: "nssf-certificate",
  }),
);
app.use(
  "/wcf",
  employerRouter({
    portal: "wcf",
    portalName: "WCF Employer Portal",
    base: "/wcf",
    formId: "wcf-form",
    statusId: "wcf-status",
    numberId: "wcf-number",
    certId: "wcf-certificate",
  }),
);
app.use("/osha", oshaRouter());

app.get("/", (_req, res) => {
  res.type("html").send(
    `<!doctype html><html><head><title>Portal Simulator</title></head><body><main>` +
      `<h1>Tanzania Government Portal Simulator</h1><ul>` +
      `<li><a href="/brela-ors/">BRELA ORS</a></li>` +
      `<li><a href="/tra/">TRA Taxpayer Portal</a></li>` +
      `<li><a href="/tnbp/licence/apply">TNBP</a></li>` +
      `<li><a href="/tausi/licence/apply">TAUSI</a></li>` +
      `<li><a href="/nssf/employer/register">NSSF</a></li>` +
      `<li><a href="/wcf/employer/register">WCF</a></li>` +
      `<li><a href="/osha/workplace/register">OSHA WIMS</a></li>` +
      `</ul></main></body></html>`,
  );
});

app.use((_req: Request, res: Response) => {
  res.status(404).type("html").send("<main><h1>404 — Not found</h1></main>");
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).send("Internal simulator error: " + err.message);
});

const port = Number(process.env.PORT ?? 4100);
app.listen(port, () => {
  console.log(`[simulator] listening on http://localhost:${port}`);
});
