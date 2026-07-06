import { makeLicenceRouter } from "./licence.js";

export const tausiRouter = makeLicenceRouter({
  portal: "tausi",
  portalName: "TAUSI Local Government Revenue Portal",
  payee: "LGA",
  defaultAmount: 80000,
  authority: "Local Government Authority (LGA)",
  certificateTitle: "Business Licence — Class B",
});
