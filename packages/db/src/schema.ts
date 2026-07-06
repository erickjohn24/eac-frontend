import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

/* ------------------------------- auth ---------------------------------- */
/** Better Auth manages its own tables (user, session, account, verification)
 *  via its Drizzle adapter; we extend the user with app fields. */

export const users = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  phone: text("phone"),
  locale: text("locale").notNull().default("en"),
  expoPushTokens: jsonb("expo_push_tokens").$type<string[]>().notNull().default([]),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const accounts = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const verifications = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/* ------------------------------ companies ------------------------------ */

export const companies = pgTable(
  "companies",
  {
    id: id(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull(),
    alternativeNames: jsonb("alternative_names").$type<string[]>().notNull().default([]),
    nameStatus: text("name_status").notNull().default("proposed"),
    incorporationNumber: text("incorporation_number"),
    incorporationDate: timestamp("incorporation_date", { withTimezone: true }),
    tin: text("tin"),
    vrn: text("vrn"),
    region: text("region").notNull(),
    district: text("district").notNull(),
    physicalAddress: text("physical_address").notNull(),
    postalAddress: text("postal_address"),
    businessActivityIsic: jsonb("business_activity_isic").$type<string[]>().notNull().default([]),
    activityDescription: text("activity_description").notNull().default(""),
    shareCapitalTzs: integer("share_capital_tzs").notNull().default(0),
    totalShares: integer("total_shares").notNull().default(0),
    fyEndMonth: integer("fy_end_month").notNull().default(12),
    expectedAnnualTurnoverTzs: integer("expected_annual_turnover_tzs").notNull().default(0),
    voluntaryVat: boolean("voluntary_vat").notNull().default(false),
    employeeCount: integer("employee_count").notNull().default(0),
    status: text("status").notNull().default("draft"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("companies_owner_idx").on(t.ownerUserId)],
);

export const people = pgTable(
  "people",
  {
    id: id(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    roles: jsonb("roles").$type<string[]>().notNull().default([]),
    nationality: text("nationality").notNull().default("Tanzanian"),
    nin: text("nin"),
    ninVerified: boolean("nin_verified").notNull().default(false),
    tin: text("tin"),
    tinVerified: boolean("tin_verified").notNull().default(false),
    passportNo: text("passport_no"),
    email: text("email"),
    phone: text("phone"),
    sharesHeld: integer("shares_held").notNull().default(0),
    kycStatus: text("kyc_status").notNull().default("pending"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("people_company_idx").on(t.companyId)],
);

/* ------------------------------ pipeline ------------------------------- */

export const pipelineRuns = pgTable(
  "pipeline_runs",
  {
    id: id(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    pipelineVersion: integer("pipeline_version").notNull(),
    mode: text("mode").notNull().default("sandbox"),
    status: text("status").notNull().default("running"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("pipeline_runs_company_idx").on(t.companyId)],
);

export const stepRuns = pgTable(
  "step_runs",
  {
    id: id(),
    pipelineRunId: uuid("pipeline_run_id")
      .notNull()
      .references(() => pipelineRuns.id, { onDelete: "cascade" }),
    stepId: text("step_id").notNull(),
    status: text("status").notNull().default("pending"),
    attempt: integer("attempt").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    /** ISO timestamp before which the runner must not pick this step up */
    notBefore: timestamp("not_before", { withTimezone: true }),
    /** worker instance currently executing (lease) */
    lockedBy: text("locked_by"),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    resultData: jsonb("result_data").$type<Record<string, unknown>>(),
    errorDetail: text("error_detail"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("step_runs_run_step_idx").on(t.pipelineRunId, t.stepId),
    index("step_runs_status_idx").on(t.status),
  ],
);

/** Durable signals: HITL resolutions and external events a step waits on. */
export const signals = pgTable(
  "signals",
  {
    id: id(),
    stepRunId: uuid("step_run_id")
      .notNull()
      .references(() => stepRuns.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("signals_step_idx").on(t.stepRunId, t.consumedAt)],
);

/** Durable timers: wake a step (or scheduler job) at a future time. */
export const wakeups = pgTable(
  "wakeups",
  {
    id: id(),
    kind: text("kind").notNull(), // step_retry | govt_poll | compliance_tick | reminder
    stepRunId: uuid("step_run_id").references(() => stepRuns.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    firedAt: timestamp("fired_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("wakeups_due_idx").on(t.dueAt, t.firedAt)],
);

/* -------------------------------- HITL --------------------------------- */

export const hitlRequests = pgTable(
  "hitl_requests",
  {
    id: id(),
    stepRunId: uuid("step_run_id")
      .notNull()
      .references(() => stepRuns.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    instructionsMd: text("instructions_md").notNull().default(""),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    status: text("status").notNull().default("open"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    resolvedByUserId: text("resolved_by_user_id").references(() => users.id),
    resolution: jsonb("resolution").$type<Record<string, unknown>>(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("hitl_company_status_idx").on(t.companyId, t.status),
    index("hitl_step_idx").on(t.stepRunId),
  ],
);

/* ------------------------------ documents ------------------------------ */

export const documents = pgTable(
  "documents",
  {
    id: id(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    stepRunId: uuid("step_run_id").references(() => stepRuns.id),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull().default("application/pdf"),
    sizeBytes: integer("size_bytes").notNull().default(0),
    sha256: text("sha256").notNull().default(""),
    source: text("source").notNull().default("generated"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("documents_company_idx").on(t.companyId, t.kind)],
);

/* ------------------------------ payments ------------------------------- */

export const payments = pgTable(
  "payments",
  {
    id: id(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    stepRunId: uuid("step_run_id").references(() => stepRuns.id),
    gepgControlNumber: text("gepg_control_number").notNull(),
    description: text("description").notNull().default(""),
    amountTzs: integer("amount_tzs").notNull(),
    payee: text("payee").notNull(),
    status: text("status").notNull().default("issued"),
    method: text("method"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    receiptDocumentId: uuid("receipt_document_id").references(() => documents.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("payments_control_number_idx").on(t.gepgControlNumber),
    index("payments_company_idx").on(t.companyId),
  ],
);

/* ----------------------------- compliance ------------------------------ */

export const complianceObligations = pgTable(
  "compliance_obligations",
  {
    id: id(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    cadence: text("cadence").notNull(),
    nextDueDate: timestamp("next_due_date", { withTimezone: true }),
    autoFileCapable: boolean("auto_file_capable").notNull().default(false),
    autoFileEnabled: boolean("auto_file_enabled").notNull().default(true),
    status: text("status").notNull().default("active"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("obligations_company_type_idx").on(t.companyId, t.type)],
);

export const complianceEvents = pgTable(
  "compliance_events",
  {
    id: id(),
    obligationId: uuid("obligation_id")
      .notNull()
      .references(() => complianceObligations.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    periodLabel: text("period_label").notNull(),
    dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("upcoming"),
    filedAt: timestamp("filed_at", { withTimezone: true }),
    paymentId: uuid("payment_id").references(() => payments.id),
    penaltyEstimateTzs: integer("penalty_estimate_tzs"),
    detail: jsonb("detail").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("events_obligation_period_idx").on(t.obligationId, t.periodLabel),
    index("events_company_due_idx").on(t.companyId, t.dueDate),
  ],
);

/* ---------------------------- agent sessions --------------------------- */

export const agentSessions = pgTable(
  "agent_sessions",
  {
    id: id(),
    stepRunId: uuid("step_run_id")
      .notNull()
      .references(() => stepRuns.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    portal: text("portal").notNull(),
    mode: text("mode").notNull().default("sandbox"),
    status: text("status").notNull().default("running"),
    modelCalls: jsonb("model_calls")
      .$type<{ model: string; inputTokens: number; outputTokens: number; count: number }[]>()
      .notNull()
      .default([]),
    traceStorageKey: text("trace_storage_key"),
    videoStorageKey: text("video_storage_key"),
    liveFrameKey: text("live_frame_key"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("agent_sessions_step_idx").on(t.stepRunId)],
);

export const agentActions = pgTable(
  "agent_actions",
  {
    id: id(),
    agentSessionId: uuid("agent_session_id")
      .notNull()
      .references(() => agentSessions.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    kind: text("kind").notNull(),
    detail: text("detail").notNull().default(""),
    selector: text("selector"),
    valueRedacted: text("value_redacted"),
    screenshotKey: text("screenshot_key"),
    aiModel: text("ai_model"),
    latencyMs: integer("latency_ms"),
    createdAt: createdAt(),
  },
  (t) => [index("agent_actions_session_seq_idx").on(t.agentSessionId, t.seq)],
);

/** Cache of AI-resolved actions for deterministic replay. */
export const actionCache = pgTable(
  "action_cache",
  {
    id: id(),
    portal: text("portal").notNull(),
    flowStep: text("flow_step").notNull(),
    domFingerprint: text("dom_fingerprint").notNull(),
    action: jsonb("action").$type<Record<string, unknown>>().notNull(),
    hits: integer("hits").notNull().default(0),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("action_cache_key_idx").on(t.portal, t.flowStep, t.domFingerprint),
  ],
);

/* ------------------------------- audit --------------------------------- */

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    actorType: text("actor_type").notNull(), // user | agent | system
    actorId: text("actor_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    companyId: uuid("company_id"),
    diff: jsonb("diff").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("audit_company_idx").on(t.companyId, t.createdAt)],
);

/* ---------------------------- credentials ------------------------------ */

export const portalCredentials = pgTable(
  "portal_credentials",
  {
    id: id(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    portal: text("portal").notNull(),
    username: text("username").notNull(),
    secretCiphertext: text("secret_ciphertext").notNull(),
    nonce: text("nonce").notNull(),
    rotatedAt: timestamp("rotated_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("credentials_company_portal_idx").on(t.companyId, t.portal)],
);

/* --------------------------- fulfillment ------------------------------- */

export const fulfillmentOrders = pgTable(
  "fulfillment_orders",
  {
    id: id(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    stepRunId: uuid("step_run_id").references(() => stepRuns.id),
    kind: text("kind").notNull().default("company_stamp"),
    vendorId: text("vendor_id").notNull(),
    vendorName: text("vendor_name").notNull(),
    priceTzs: integer("price_tzs").notNull(),
    status: text("status").notNull().default("ordered"), // ordered | in_production | dispatched | delivered
    trackingNote: text("tracking_note"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("fulfillment_company_idx").on(t.companyId)],
);
