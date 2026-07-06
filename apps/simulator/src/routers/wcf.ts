import { makeEmployerRouter } from "./employer.js";

export const wcfRouter = makeEmployerRouter({
  portal: "wcf",
  portalName: "Workers Compensation Fund (WCF)",
  authority: "Workers Compensation Fund (WCF)",
  certificateTitle: "Certificate of Employer Registration",
});
