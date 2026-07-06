import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, "../data");
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(path.join(dataDir, "uploads"), { recursive: true });

export const db = new Database(path.join(dataDir, "sim.sqlite"));
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  portal TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  password TEXT NOT NULL,
  full_name TEXT,
  nin TEXT,
  activated INTEGER NOT NULL DEFAULT 0,
  activation_token TEXT,
  otp TEXT,
  otp_expires_at INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER,
  proposed_name TEXT NOT NULL,
  entity_type TEXT,
  nature_of_business TEXT,
  status TEXT NOT NULL DEFAULT 'pending_payment',
  reservation_number TEXT,
  control_number TEXT,
  due_at INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER,
  reservation_number TEXT,
  company_name TEXT,
  share_capital TEXT,
  total_shares TEXT,
  physical_address TEXT,
  region TEXT,
  district TEXT,
  directors TEXT,
  shareholders TEXT,
  status TEXT NOT NULL DEFAULT 'pending_payment',
  incorporation_number TEXT,
  incorporation_date TEXT,
  control_number TEXT,
  due_at INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS tin_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER,
  incorporation_number TEXT,
  company_name TEXT,
  physical_address TEXT,
  region TEXT,
  business_sector TEXT,
  rep_full_name TEXT,
  rep_nin TEXT,
  rep_tin TEXT,
  status TEXT NOT NULL DEFAULT 'biometrics_pending',
  appointment_ref TEXT,
  biometrics_done INTEGER NOT NULL DEFAULT 0,
  tin TEXT,
  due_at INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS vat_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER,
  tin TEXT,
  expected_turnover TEXT,
  business_description TEXT,
  status TEXT NOT NULL DEFAULT 'verification_pending',
  vrn TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS licence_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  portal TEXT NOT NULL,
  tin TEXT,
  incorporation_number TEXT,
  business_name TEXT,
  activity_code TEXT,
  premises_address TEXT,
  status TEXT NOT NULL DEFAULT 'pending_payment',
  licence_number TEXT,
  control_number TEXT,
  due_at INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS employer_registrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  portal TEXT NOT NULL,
  tin TEXT,
  company_name TEXT,
  incorporation_number TEXT,
  employee_count TEXT,
  contact_email TEXT,
  status TEXT NOT NULL DEFAULT 'processing',
  reg_number TEXT,
  due_at INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS osha_registrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tin TEXT,
  company_name TEXT,
  workplace_address TEXT,
  employee_count TEXT,
  risk_category TEXT,
  status TEXT NOT NULL DEFAULT 'inspection_pending',
  inspection_ref TEXT,
  osha_number TEXT,
  due_at INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS bills (
  control_number TEXT PRIMARY KEY,
  amount_tzs INTEGER NOT NULL,
  payee TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  receipt_no TEXT,
  linked_kind TEXT,
  linked_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  to_addr TEXT NOT NULL,
  channel TEXT NOT NULL,
  subject TEXT,
  body TEXT,
  sent_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

export interface SimConfig {
  approvalDelayMs: number;
  latencyMs: number;
  failureRate: number;
}

const CONFIG_DEFAULTS: SimConfig = { approvalDelayMs: 8000, latencyMs: 0, failureRate: 0 };

export function getConfig(): SimConfig {
  const rows = db.prepare("SELECT key, value FROM config").all() as { key: string; value: string }[];
  const cfg: SimConfig = { ...CONFIG_DEFAULTS };
  for (const row of rows) {
    if (row.key in cfg) (cfg as unknown as Record<string, number>)[row.key] = Number(row.value);
  }
  return cfg;
}

export function setConfig(partial: Partial<SimConfig>): SimConfig {
  const upsert = db.prepare(
    "INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  );
  for (const key of Object.keys(CONFIG_DEFAULTS) as (keyof SimConfig)[]) {
    const v = partial[key];
    if (v !== undefined && Number.isFinite(Number(v))) upsert.run(key, String(Number(v)));
  }
  return getConfig();
}

export function resetAll(): void {
  const tables = [
    "accounts",
    "reservations",
    "applications",
    "tin_applications",
    "vat_applications",
    "licence_applications",
    "employer_registrations",
    "osha_registrations",
    "bills",
    "messages",
    "config",
  ];
  const wipe = db.transaction(() => {
    for (const t of tables) db.prepare(`DELETE FROM ${t}`).run();
    db.prepare("DELETE FROM sqlite_sequence").run();
  });
  wipe();
}

export function sendMessage(to: string, channel: "email" | "sms", subject: string, body: string): void {
  db.prepare("INSERT INTO messages (to_addr, channel, subject, body) VALUES (?, ?, ?, ?)").run(
    to,
    channel,
    subject,
    body,
  );
}

export function createBill(
  amountTzs: number,
  payee: string,
  description: string,
  linkedKind: string,
  linkedId: number,
): string {
  let controlNumber = "";
  for (let i = 0; i < 20; i++) {
    controlNumber = "9917" + String(Math.floor(Math.random() * 10_000_000)).padStart(7, "0");
    const exists = db.prepare("SELECT 1 FROM bills WHERE control_number = ?").get(controlNumber);
    if (!exists) break;
  }
  db.prepare(
    "INSERT INTO bills (control_number, amount_tzs, payee, description, linked_kind, linked_id) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(controlNumber, amountTzs, payee, description, linkedKind, linkedId);
  return controlNumber;
}
