import { makeLicenceRouter } from "./licence.js";

export const tnbpRouter = makeLicenceRouter({
  portal: "tnbp",
  portalName: "Tanzania National Business Portal (TNBP)",
  payee: "MIT",
  defaultAmount: 150000,
  authority: "Ministry of Industry and Trade (MIT)",
  certificateTitle: "Business Licence — Class A",
});
