import type { Page } from "playwright";
import type { AutomationMode, HITLResolution, HITLType, PortalId } from "@tz/shared";

export type { HITLResolution, HITLType, AutomationMode, PortalId } from "@tz/shared";

/**
 * Execution semantics for flows (Inngest-style memoized re-execution):
 *
 * A flow function may be executed MANY times for one logical step run — after
 * each HITL suspension, government wait, or retry, the engine re-invokes it
 * from the top. Flows therefore make themselves idempotent with
 * `ctx.checkpoint`: durable per-step state persisted between executions.
 * Use `ctx.memo(key, fn)` for any side-effectful sub-step: it runs `fn` once,
 * stores the result in the checkpoint, and returns the stored value on
 * subsequent executions.
 */

export interface FlowContext {
  companyId: string;
  stepRunId: string;
  mode: AutomationMode;
  portal: PortalId;
  /** base URL of the portal in the current mode */
  portalUrl: string;
  /** Playwright page with tracing + video + action recording attached */
  page: Page;
  /** structured audit logging; also captures screenshots */
  actions: ActionRecorder;
  /** durable step-scoped state (persisted in step_runs.result_data.checkpoint) */
  checkpoint: Record<string, unknown>;
  /** run a sub-step exactly once across re-executions */
  memo<T>(key: string, fn: () => Promise<T>): Promise<T>;
  /** request human input; returns resolution if present, else throws HITLRequired */
  hitl: {
    require(request: {
      key: string;
      type: HITLType;
      title: string;
      instructionsMd: string;
      payload?: Record<string, unknown>;
      expiresInMinutes?: number;
    }): Promise<HITLResolution>;
  };
  /** virtual inbox (sandbox): read OTPs/activation emails the customer received */
  inbox: InboxClient;
  /** encrypted portal credential storage */
  vault: VaultClient;
  /** file storage for artifacts and documents */
  storage: StorageAdapter;
  /** AI assistance layer (tier 2/3); disabled without ANTHROPIC_API_KEY */
  ai: AiLayer;
  /** typed access to company data and artifact persistence */
  repo: FlowRepo;
  /** payments (GePG) client for the current mode */
  gepg: import("./gepg.js").GepgClient;
  logger: (msg: string) => void;
}

/** Minimal record shapes flows read/write, decoupled from the DB package. */
export interface CompanyRecord {
  id: string;
  name: string;
  alternativeNames: string[];
  nameStatus: string;
  incorporationNumber: string | null;
  incorporationDate: Date | null;
  tin: string | null;
  vrn: string | null;
  region: string;
  district: string;
  physicalAddress: string;
  businessActivityIsic: string[];
  activityDescription: string;
  shareCapitalTzs: number;
  totalShares: number;
  fyEndMonth: number;
  expectedAnnualTurnoverTzs: number;
  voluntaryVat: boolean;
  employeeCount: number;
  ownerUserId: string;
}

export interface PersonRecord {
  id: string;
  fullName: string;
  roles: string[];
  nationality: string;
  nin: string | null;
  tin: string | null;
  passportNo: string | null;
  email: string | null;
  phone: string | null;
  sharesHeld: number;
}

export interface FlowRepo {
  getCompany(companyId: string): Promise<CompanyRecord>;
  updateCompany(companyId: string, patch: Partial<CompanyRecord>): Promise<void>;
  getPeople(companyId: string): Promise<PersonRecord[]>;
  addDocument(doc: {
    companyId: string;
    stepRunId: string;
    kind: string;
    title: string;
    data: Buffer;
    mimeType?: string;
    source?: string;
    expiresAt?: Date | null;
  }): Promise<{ id: string; storageKey: string }>;
  createPayment(p: {
    companyId: string;
    stepRunId: string;
    gepgControlNumber: string;
    description: string;
    amountTzs: number;
    payee: string;
  }): Promise<{ id: string }>;
  markPaymentPaid(gepgControlNumber: string, method: string): Promise<void>;
  createFulfillmentOrder(o: {
    companyId: string;
    stepRunId: string;
    kind: string;
    vendorId: string;
    vendorName: string;
    priceTzs: number;
  }): Promise<{ id: string }>;
}

export interface FlowResult {
  /** merged into step_runs.result_data (visible to UI + dependent steps) */
  output: Record<string, unknown>;
}

export type Flow = (ctx: FlowContext, input: Record<string, unknown>) => Promise<FlowResult>;

export interface ActionRecorder {
  record(action: {
    kind:
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
    detail: string;
    selector?: string;
    /** NEVER pass secrets; redact before recording */
    valueRedacted?: string;
    aiModel?: string;
    latencyMs?: number;
  }): Promise<void>;
  /** capture the current page screenshot; returns storage key */
  screenshot(label: string): Promise<string>;
}

export interface SimMessage {
  id: string;
  to: string;
  channel: "email" | "sms";
  subject: string;
  body: string;
  sentAt: string;
}

export interface InboxClient {
  /** list messages sent to an address/phone, newest first */
  list(to: string): Promise<SimMessage[]>;
  /** poll until a message matching the predicate arrives (sandbox only) */
  waitFor(
    to: string,
    predicate: (m: SimMessage) => boolean,
    timeoutMs?: number,
  ): Promise<SimMessage | null>;
}

export interface VaultClient {
  get(companyId: string, portal: PortalId): Promise<{ username: string; secret: string } | null>;
  set(companyId: string, portal: PortalId, username: string, secret: string): Promise<void>;
}

export interface StorageAdapter {
  put(key: string, data: Buffer, mimeType?: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  publicPath(key: string): string;
}

/** Structured action the AI layer proposes for a page. */
export interface AiAction {
  op: "click" | "fill" | "select" | "none";
  selector: string;
  value?: string;
  reasoning: string;
}

export interface AiLayer {
  enabled: boolean;
  /** natural-language action on the current page (tier 2, a11y-tree based) */
  act(page: Page, instruction: string, flowStep: string): Promise<AiAction>;
  /** extract structured data from the current page */
  extract<T>(page: Page, instruction: string, exampleJson: string): Promise<T | null>;
}
