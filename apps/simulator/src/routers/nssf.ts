import { makeEmployerRouter } from "./employer.js";

export const nssfRouter = makeEmployerRouter({
  portal: "nssf",
  portalName: "National Social Security Fund (NSSF)",
  authority: "National Social Security Fund (NSSF)",
  certificateTitle: "Certificate of Employer Registration",
});
