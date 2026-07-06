import type { AutomationMode, PortalId } from "./types.js";

/** Registry mapping each portal to its base URL per automation mode. */

export interface PortalInfo {
  id: PortalId;
  name: string;
  authority: string;
  liveUrl: string;
  /** path under SIMULATOR_URL in sandbox mode */
  simPath: string;
}

export const PORTALS: Record<PortalId, PortalInfo> = {
  brela_ors: {
    id: "brela_ors",
    name: "BRELA Online Registration System",
    authority: "Business Registrations and Licensing Agency",
    liveUrl: "https://ors.brela.go.tz",
    simPath: "/brela-ors",
  },
  tra: {
    id: "tra",
    name: "TRA Taxpayer Portal",
    authority: "Tanzania Revenue Authority",
    liveUrl: "https://taxpayerportal.tra.go.tz",
    simPath: "/tra",
  },
  tnbp: {
    id: "tnbp",
    name: "Tanzania National Business Portal",
    authority: "Ministry of Industry and Trade / BRELA",
    liveUrl: "https://business.go.tz",
    simPath: "/tnbp",
  },
  tausi: {
    id: "tausi",
    name: "TAUSI Local Government Portal",
    authority: "TAMISEMI / Local Government Authorities",
    liveUrl: "https://tausi.tamisemi.go.tz",
    simPath: "/tausi",
  },
  nssf: {
    id: "nssf",
    name: "NSSF Employer Portal",
    authority: "National Social Security Fund",
    liveUrl: "https://employer-portal.nssf.go.tz",
    simPath: "/nssf",
  },
  wcf: {
    id: "wcf",
    name: "WCF Employer Portal",
    authority: "Workers Compensation Fund",
    liveUrl: "https://www.wcf.go.tz",
    simPath: "/wcf",
  },
  osha: {
    id: "osha",
    name: "OSHA WIMS",
    authority: "Occupational Safety and Health Authority",
    liveUrl: "https://wims.osha.go.tz",
    simPath: "/osha",
  },
  gepg: {
    id: "gepg",
    name: "Government Electronic Payment Gateway",
    authority: "Ministry of Finance",
    liveUrl: "https://www.gepg.go.tz",
    simPath: "/gepg",
  },
};

export function portalBaseUrl(
  portal: PortalId,
  mode: AutomationMode,
  simulatorUrl: string,
): string {
  const info = PORTALS[portal];
  return mode === "live" ? info.liveUrl : `${simulatorUrl}${info.simPath}`;
}
