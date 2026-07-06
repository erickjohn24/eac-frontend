import crypto from "node:crypto";

const CAPTCHA_SECRET = "sim-captcha-secret";

export function randomDigits(n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

export function randomHex(n: number): string {
  return crypto.randomBytes(n).toString("hex");
}

function captchaMac(a: number, b: number): string {
  return crypto.createHmac("sha256", CAPTCHA_SECRET).update(`${a}+${b}`).digest("hex").slice(0, 16);
}

export function makeCaptcha(): { question: string; token: string } {
  const a = 1 + Math.floor(Math.random() * 9);
  const b = 1 + Math.floor(Math.random() * 9);
  return { question: `What is ${a} + ${b}?`, token: `${a}.${b}.${captchaMac(a, b)}` };
}

export function checkCaptcha(token: string | undefined, answer: string | undefined): boolean {
  if (!token || answer === undefined) return false;
  const parts = String(token).split(".");
  if (parts.length !== 3) return false;
  const a = Number(parts[0]);
  const b = Number(parts[1]);
  if (!Number.isInteger(a) || !Number.isInteger(b)) return false;
  if (parts[2] !== captchaMac(a, b)) return false;
  return Number(String(answer).trim()) === a + b;
}

const FIRST_NAMES = ["Amani", "Baraka", "Neema", "Juma", "Fatuma", "Salim", "Zawadi", "Rehema", "Emmanuel", "Halima"];
const MIDDLE_NAMES = ["Josephat", "Mwajuma", "Peter", "Asha", "Hassan", "Grace", "Rashidi", "Maria", "Selemani", "Anna"];
const LAST_NAMES = ["Mwakalinga", "Kimaro", "Massawe", "Ndosi", "Mushi", "Komba", "Mgaya", "Shayo", "Lyimo", "Temba"];

/** Deterministic fake full name from the digits of a NIN. */
export function nidaName(nin: string): string {
  const d = nin.replace(/\D/g, "").padEnd(3, "0");
  const first = FIRST_NAMES[Number(d[0]) % FIRST_NAMES.length];
  const middle = MIDDLE_NAMES[Number(d[1]) % MIDDLE_NAMES.length];
  const last = LAST_NAMES[Number(d[2]) % LAST_NAMES.length];
  return `${first} ${middle} ${last}`.toUpperCase();
}

export function makeOtp(): string {
  return randomDigits(6);
}

export function nowMs(): number {
  return Date.now();
}
