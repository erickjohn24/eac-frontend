/** Display constants: fees, regions, ISIC activity shortlist. */

export const TZS = new Intl.NumberFormat("en-TZ", {
  style: "currency",
  currency: "TZS",
  maximumFractionDigits: 0,
});

export function formatTzs(amount: number): string {
  return TZS.format(amount);
}

export const TANZANIA_REGIONS = [
  "Arusha", "Dar es Salaam", "Dodoma", "Geita", "Iringa", "Kagera", "Katavi",
  "Kigoma", "Kilimanjaro", "Lindi", "Manyara", "Mara", "Mbeya", "Morogoro",
  "Mtwara", "Mwanza", "Njombe", "Pwani", "Rukwa", "Ruvuma", "Shinyanga",
  "Simiyu", "Singida", "Songwe", "Tabora", "Tanga",
] as const;

/** Curated ISIC Rev.4 shortlist for the onboarding activity picker. */
export const ISIC_ACTIVITIES: { code: string; label: string }[] = [
  { code: "4711", label: "Retail trade (general stores, supermarkets)" },
  { code: "4791", label: "E-commerce / online retail" },
  { code: "6201", label: "Software development" },
  { code: "6202", label: "IT consultancy" },
  { code: "6311", label: "Data processing & hosting" },
  { code: "4632", label: "Wholesale of food products" },
  { code: "1071", label: "Manufacture of bakery products" },
  { code: "5610", label: "Restaurants & food service" },
  { code: "5510", label: "Hotels & accommodation" },
  { code: "7911", label: "Travel agency" },
  { code: "4923", label: "Freight transport by road" },
  { code: "6820", label: "Real estate activities" },
  { code: "7020", label: "Management consultancy" },
  { code: "6910", label: "Legal activities" },
  { code: "6920", label: "Accounting & bookkeeping" },
  { code: "8559", label: "Education & training services" },
  { code: "8690", label: "Health services" },
  { code: "0111", label: "Crop farming" },
  { code: "0141", label: "Livestock farming" },
  { code: "4100", label: "Construction of buildings" },
  { code: "7410", label: "Design & creative services" },
  { code: "5911", label: "Media & film production" },
  { code: "6419", label: "Financial services (non-bank)" },
  { code: "6612", label: "Fintech & payments support" },
];

export const BANKS = [
  { id: "crdb", name: "CRDB Bank", account: "Biashara Account", minOpeningTzs: 150_000 },
  { id: "nmb", name: "NMB Bank", account: "Business Plus", minOpeningTzs: 150_000 },
  { id: "nbc", name: "NBC Bank", account: "Business Current", minOpeningTzs: 200_000 },
  { id: "stanbic", name: "Stanbic Bank", account: "Business Current", minOpeningTzs: 200_000 },
] as const;

export const STAMP_VENDORS = [
  { id: "trsw", name: "Tanzania Rubber Stamp Works", location: "Dar es Salaam CBD", priceTzs: 35_000, etaDays: 1 },
  { id: "tzsign", name: "TZ Signwriters & Seals", location: "Kariakoo, Dar es Salaam", priceTzs: 25_000, etaDays: 2 },
] as const;
