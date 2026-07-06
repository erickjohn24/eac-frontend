/**
 * NIDA (National Identification Authority) identity lookup.
 *
 * The whole product is built on a "never ask for what we can already get"
 * principle: given a National Identification Number (NIN), NIDA already holds
 * the person's legal name, date of birth, sex and nationality — so the intake
 * must NOT ask for those again. In sandbox we resolve a deterministic identity
 * from the NIN (stable per NIN, realistic Tanzanian names). In live mode this
 * interface is backed by the real NIDA verification channel.
 */

export interface NidaIdentity {
  nin: string;
  fullName: string;
  firstName: string;
  middleName?: string;
  surname: string;
  sex: "M" | "F";
  dateOfBirth: string; // ISO date
  nationality: string;
  /** masked for display, e.g. "1122 **** **** **90" */
  ninMasked: string;
}

const MALE_FIRST = [
  "Juma", "Baraka", "Emmanuel", "John", "Hamisi", "Frank", "Joseph", "Elias",
  "Godfrey", "Nuru", "Rashid", "Iddi", "Peter", "Daudi", "Salum", "Erick",
];
const FEMALE_FIRST = [
  "Amina", "Neema", "Grace", "Zawadi", "Fatuma", "Mariam", "Happy", "Rehema",
  "Halima", "Upendo", "Joyce", "Asha", "Getrude", "Devota", "Salma", "Lulu",
];
const MIDDLE = [
  "Athumani", "Baraka", "Mussa", "Shabani", "Elias", "Hamis", "Juma", "Said",
  "Peter", "James", "Frank", "Ally", "Omary", "Kelvin", "Michael",
];
const SURNAMES = [
  "Mushi", "Kessy", "Mwakyusa", "Mng'ong'o", "Shirima", "Massawe", "Kimaro",
  "Nyerere", "Mbwana", "Kikwete", "Lyimo", "Swai", "Mrema", "Mollel", "Macha",
  "Ngowi", "Sanga", "Mwakalinga", "Chambo", "Ulomi",
];

function digitsToNums(nin: string): number[] {
  return nin.split("").map((c) => Number(c) || 0);
}

/** Deterministic sandbox identity. Same NIN always yields the same person. */
export function sandboxNidaLookup(nin: string): NidaIdentity | null {
  const clean = nin.replace(/\D/g, "");
  if (clean.length !== 20) return null;
  // Business rule mirrored from the portals: NINs starting with 9 are "not found".
  if (clean.startsWith("9")) return null;

  const d = digitsToNums(clean);
  const sum = d.reduce((a, b) => a + b, 0);
  const isFemale = d[8]! % 2 === 0;
  const first = (isFemale ? FEMALE_FIRST : MALE_FIRST)[sum % 16]!;
  const middle = MIDDLE[(d[3]! + d[7]!) % MIDDLE.length]!;
  const surname = SURNAMES[(d[1]! * 3 + d[5]!) % SURNAMES.length]!;

  // NIN in Tanzania encodes birth date in the first 8 digits (YYYYMMDD).
  const year = 1960 + (Number(clean.slice(0, 2)) % 45);
  const month = (Number(clean.slice(8, 10)) % 12) + 1;
  const day = (Number(clean.slice(10, 12)) % 27) + 1;
  const dob = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  return {
    nin: clean,
    fullName: `${first} ${middle} ${surname}`,
    firstName: first,
    middleName: middle,
    surname,
    sex: isFemale ? "F" : "M",
    dateOfBirth: dob,
    nationality: "Tanzanian",
    ninMasked: `${clean.slice(0, 4)} **** **** ${clean.slice(-2)}`,
  };
}

/** TIN verification result (as BRELA ORS gets from TRA). */
export interface TinVerification {
  tin: string;
  valid: boolean;
  registeredName?: string;
}

export function sandboxTinVerify(tin: string, name?: string): TinVerification {
  const clean = tin.replace(/\D/g, "");
  const valid = clean.length === 9 && !clean.startsWith("999");
  return {
    tin: formatTin(clean),
    valid,
    registeredName: valid ? name : undefined,
  };
}

export function formatTin(tin: string): string {
  const c = tin.replace(/\D/g, "").slice(0, 9);
  if (c.length < 9) return c;
  return `${c.slice(0, 3)}-${c.slice(3, 6)}-${c.slice(6)}`;
}
