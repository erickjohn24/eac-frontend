/** Core domain types shared across web, mobile, worker, and API. */

export type AutomationMode = "sandbox" | "live";

export type PortalId =
  | "brela_ors"
  | "tra"
  | "tnbp"
  | "tausi"
  | "nssf"
  | "wcf"
  | "osha"
  | "gepg";

export type CompanyStatus =
  | "draft"
  | "in_pipeline"
  | "registered"
  | "compliant"
  | "at_risk";

export type PersonRole = "director" | "shareholder" | "secretary" | "signatory";

export type PipelineRunStatus =
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export type StepRunStatus =
  | "pending"
  | "blocked"
  | "running"
  | "awaiting_human"
  | "awaiting_govt"
  | "succeeded"
  | "failed"
  | "skipped";

export type HITLType =
  | "otp_entry"
  | "payment_authorization"
  | "document_upload"
  | "appointment"
  | "physical_visit"
  | "captcha_handoff"
  | "data_confirmation"
  | "signature";

export type HITLStatus = "open" | "completed" | "expired" | "cancelled";

export type DocumentKind =
  | "memarts"
  | "declaration_of_compliance"
  | "incorporation_certificate"
  | "name_reservation_certificate"
  | "tin_certificate"
  | "vat_certificate"
  | "business_licence"
  | "lease_agreement"
  | "board_resolution"
  | "bank_pack"
  | "nssf_certificate"
  | "wcf_certificate"
  | "osha_certificate"
  | "receipt"
  | "other";

export type PaymentStatus =
  | "issued"
  | "awaiting_payer"
  | "paid"
  | "verified"
  | "expired";

export type PaymentMethod = "mpesa" | "tigopesa" | "airtel_money" | "halopesa" | "bank";

export type Payee =
  | "BRELA"
  | "TRA"
  | "LGA"
  | "MIT"
  | "NSSF"
  | "WCF"
  | "OSHA"
  | "VENDOR";

export type ObligationType =
  | "paye_sdl"
  | "vat_return"
  | "provisional_tax"
  | "final_return"
  | "nssf_contribution"
  | "wcf_contribution"
  | "osha_annual"
  | "brela_annual_return"
  | "beneficial_ownership"
  | "licence_renewal";

export type ObligationCadence = "monthly" | "quarterly" | "annual" | "event";

export type ComplianceEventStatus =
  | "upcoming"
  | "action_needed"
  | "filing"
  | "filed"
  | "paid"
  | "late"
  | "waived";

export type AgentSessionStatus = "running" | "succeeded" | "failed" | "handed_off";

export type AgentActionKind =
  | "navigate"
  | "fill"
  | "click"
  | "select"
  | "upload"
  | "extract"
  | "screenshot"
  | "ai_decision"
  | "otp_wait"
  | "captcha_wait"
  | "download"
  | "error";

/** Wire shape of an action item shown in web/mobile inboxes. */
export interface ActionItemPayload {
  /** GePG control number, for payment_authorization items */
  controlNumber?: string;
  amountTzs?: number;
  payee?: Payee;
  /** storage key of the current portal screenshot, for captcha_handoff */
  screenshotKey?: string;
  /** the CAPTCHA prompt text, if extracted */
  captchaPrompt?: string;
  /** where the OTP was sent, e.g. masked phone/email */
  otpDestination?: string;
  /** document kind requested, for document_upload */
  documentKind?: DocumentKind;
  /** appointment details for biometric visits etc. */
  appointmentRef?: string;
  appointmentLocation?: string;
  /** free-form extras */
  [key: string]: unknown;
}

export interface HITLResolution {
  /** OTP / CAPTCHA answer typed by the user */
  code?: string;
  /** payment confirmation reference */
  paymentRef?: string;
  method?: PaymentMethod;
  /** uploaded document id */
  documentId?: string;
  /** appointment slot chosen / attended */
  confirmed?: boolean;
  notes?: string;
  [key: string]: unknown;
}
