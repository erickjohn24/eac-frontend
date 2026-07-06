import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { and, desc, eq } from "drizzle-orm";
import {
  Award,
  BadgeCheck,
  BookmarkCheck,
  Building,
  CheckCircle2,
  ChevronLeft,
  Download,
  FileCheck2,
  FileText,
  Fingerprint,
  Gavel,
  Hourglass,
  Landmark,
  Mail,
  Percent,
  Receipt,
  Rocket,
  ScrollText,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import {
  getDb,
  companies,
  documents,
  hitlRequests,
  payments,
  people,
  pipelineRuns,
  signatureRequests,
  stepRuns,
} from "@tz/db";
import { applicableRules, formatTzs, nextDueDate } from "@tz/shared";
import { Badge } from "@/components/ui/chip";
import { CopyLink } from "@/components/dashboard/copy-link";
import { LaunchedBanner } from "@/components/dashboard/launched-banner";
import { Timeline } from "@/components/dashboard/timeline";
import { Wordmark } from "@/components/dashboard/wordmark";
import {
  buildTimeline,
  computeProgress,
  formatDayMonth,
  formatFullDate,
  formatKb,
  statusPill,
  type TimelineAction,
} from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Registration — tz-compliance",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FEE_ESTIMATE = [
  { label: "Name reservation", authority: "BRELA", amount: 50_000 },
  { label: "Company incorporation", authority: "BRELA", amount: 250_000 },
  { label: "Business licence", authority: "MIT / LGA", amount: 150_000 },
] as const;

const DOC_ICONS: Record<string, LucideIcon> = {
  memarts: ScrollText,
  declaration_of_compliance: ShieldCheck,
  incorporation_certificate: Award,
  name_reservation_certificate: BookmarkCheck,
  tin_certificate: Fingerprint,
  vat_certificate: Percent,
  business_licence: BadgeCheck,
  lease_agreement: Building,
  board_resolution: Gavel,
  bank_pack: Landmark,
  nssf_certificate: FileCheck2,
  wcf_certificate: FileCheck2,
  osha_certificate: FileCheck2,
  receipt: Receipt,
};

function kindLabel(kind: string): string {
  const label = kind.replace(/_/g, " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export default async function CompanyDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ launched?: string }>;
}) {
  const { companyId } = await params;
  const sp = await searchParams;
  if (!UUID_RE.test(companyId)) notFound();

  const db = getDb();
  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  if (!company) notFound();

  const [docs, sigs, runs, pays, openHitl] = await Promise.all([
    db
      .select()
      .from(documents)
      .where(eq(documents.companyId, companyId))
      .orderBy(documents.createdAt),
    db
      .select({
        id: signatureRequests.id,
        status: signatureRequests.status,
        token: signatureRequests.token,
        personId: signatureRequests.personId,
        documentId: signatureRequests.documentId,
        personName: people.fullName,
      })
      .from(signatureRequests)
      .innerJoin(people, eq(signatureRequests.personId, people.id))
      .where(eq(signatureRequests.companyId, companyId)),
    db
      .select()
      .from(pipelineRuns)
      .where(eq(pipelineRuns.companyId, companyId))
      .orderBy(desc(pipelineRuns.startedAt))
      .limit(1),
    db
      .select()
      .from(payments)
      .where(eq(payments.companyId, companyId))
      .orderBy(payments.createdAt),
    db
      .select({
        stepId: stepRuns.stepId,
        title: hitlRequests.title,
        instructionsMd: hitlRequests.instructionsMd,
      })
      .from(hitlRequests)
      .innerJoin(stepRuns, eq(hitlRequests.stepRunId, stepRuns.id))
      .where(and(eq(hitlRequests.companyId, companyId), eq(hitlRequests.status, "open"))),
  ]);

  // ---- pipeline state ------------------------------------------------------
  const latestRun = runs[0];
  let stepStatuses: Map<string, string> | null = null;
  if (latestRun) {
    const steps = await db
      .select({ stepId: stepRuns.stepId, status: stepRuns.status })
      .from(stepRuns)
      .where(eq(stepRuns.pipelineRunId, latestRun.id));
    stepStatuses = new Map(steps.map((s) => [s.stepId, s.status]));
  }

  // ---- signatures ----------------------------------------------------------
  const sigTally = {
    total: sigs.length,
    signed: sigs.filter((s) => s.status === "signed").length,
  };
  const allSigned = sigTally.total > 0 && sigTally.signed === sigTally.total;

  const signers = new Map<
    string,
    { name: string; total: number; signed: number; pendingToken?: string }
  >();
  for (const s of sigs) {
    const entry = signers.get(s.personId) ?? { name: s.personName, total: 0, signed: 0 };
    entry.total++;
    if (s.status === "signed") entry.signed++;
    else if (!entry.pendingToken) entry.pendingToken = s.token;
    signers.set(s.personId, entry);
  }
  const signerRows = [...signers.values()];

  const docSigs = new Map<string, { total: number; signed: number }>();
  for (const s of sigs) {
    const t = docSigs.get(s.documentId) ?? { total: 0, signed: 0 };
    t.total++;
    if (s.status === "signed") t.signed++;
    docSigs.set(s.documentId, t);
  }

  // ---- open actions → timeline --------------------------------------------
  const openActions = new Map<string, TimelineAction>();
  for (const h of openHitl) {
    if (openActions.has(h.stepId)) continue;
    const firstLine = h.instructionsMd.split("\n").find((l) => l.trim())?.trim() ?? "";
    openActions.set(h.stepId, { title: h.title, instructions: firstLine });
  }

  const timeline = buildTimeline({
    employeeCount: company.employeeCount,
    companyStatus: company.status,
    stepStatuses,
    signatures: sigTally,
    openActions,
  });

  const progress = computeProgress(company.employeeCount, stepStatuses, sigTally);
  const pill = statusPill(company.status);

  // ---- compliance preview --------------------------------------------------
  const profile = {
    hasEmployees: company.employeeCount > 0,
    vatRegistered: false,
    fyEndMonth: company.fyEndMonth,
    incorporationDate: new Date().toISOString(),
  };
  const rules = applicableRules(profile);
  const now = new Date();
  const ruleRows = rules.map((rule) => ({
    type: rule.type,
    title: rule.title,
    cadence: rule.cadence,
    due: nextDueDate(rule, profile, now),
  }));
  const shownRules = ruleRows.slice(0, 6);
  const moreRules = ruleRows.length - shownRules.length;

  const feeTotal = FEE_ESTIMATE.reduce((s, f) => s + f.amount, 0);

  return (
    <div className="relative min-h-dvh">
      <div className="backdrop" />

      {/* slim top bar */}
      <header className="sticky top-0 z-30 border-b border-hairline bg-bg/85 backdrop-blur-lg">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-4 px-5 py-3">
          <div className="flex min-w-0 items-center gap-3.5">
            <Wordmark />
            <span aria-hidden className="hidden h-4 w-px bg-hairline-2 sm:block" />
            <Link
              href="/dashboard"
              className="hidden items-center gap-1 text-[0.8rem] font-medium text-fg-faint transition-colors hover:text-fg sm:inline-flex"
            >
              <ChevronLeft className="size-3.5" /> All companies
            </Link>
          </div>
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="hidden max-w-56 truncate text-[0.85rem] font-medium text-fg md:block">
              {company.name}
            </span>
            <Badge tone={pill.tone} className="shrink-0">
              {pill.label}
            </Badge>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-[1100px] px-5 pb-24 pt-10">
        {/* heading */}
        <p className="text-eyebrow">Registration</p>
        <h1 className="text-display mt-2.5">{company.name}</h1>
        <p className="mt-2 text-[0.9rem] text-fg-muted">
          Private company limited by shares · {company.district}, {company.region}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-3">
            <div className="h-1 w-40 overflow-hidden rounded-full bg-bg-2">
              <div
                className="tz-gradient h-full rounded-full"
                style={{ width: `${Math.max(progress, 3)}%` }}
              />
            </div>
            <span className="tnum text-[0.8rem] font-medium text-fg-muted">
              {progress}% complete
            </span>
          </div>
          <span className="text-caption">Started {formatFullDate(company.createdAt)}</span>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
          {/* ------------------------------ main column ------------------- */}
          <div className="min-w-0 space-y-6">
            {sp.launched === "1" && <LaunchedBanner hasSignatures={sigTally.total > 0} />}

            {/* signatures — the pre-filing gate */}
            {sigTally.total > 0 && (
              <section className="card p-6">
                {allSigned ? (
                  <>
                    <p className="text-section text-fg">Signatures</p>
                    <div className="mt-3.5 flex items-center gap-2.5 rounded-[var(--radius)] border border-success/25 bg-success/[0.07] p-3.5">
                      <CheckCircle2 className="size-4 shrink-0 text-success" />
                      <p className="text-[0.85rem] font-medium text-success">
                        Everyone has signed — we&apos;re ready to file.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-section text-fg">Signatures needed before we file</p>
                    <p className="text-caption mt-0.5">
                      Each person signs from any device — it takes about a minute. Send them
                      their link.
                    </p>
                    <ul className="mt-4 divide-y divide-hairline">
                      {signerRows.map((person) => (
                        <li
                          key={person.name}
                          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-tz-500/15 text-[0.7rem] font-semibold text-tz-300">
                              {initials(person.name)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-[0.875rem] font-medium text-fg">
                                {person.name}
                              </p>
                              <p className="text-caption tnum">
                                {person.signed} of {person.total} signed
                              </p>
                            </div>
                          </div>
                          {person.pendingToken ? (
                            <CopyLink path={`/sign/${person.pendingToken}`} />
                          ) : (
                            <span className="flex items-center gap-1.5 text-[0.8rem] font-medium text-success">
                              <CheckCircle2 className="size-3.5" /> Signed
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {company.status === "ready_to_file" && (
                  <div className="mt-3 flex items-center gap-2.5 rounded-[var(--radius)] border border-tz-400/30 bg-tz-500/[0.08] p-3.5">
                    <Rocket className="size-4 shrink-0 text-tz-300" />
                    <p className="text-[0.85rem] text-fg">
                      Filing starts as soon as our agents pick it up.
                    </p>
                  </div>
                )}
              </section>
            )}

            {/* registration timeline */}
            <section className="card p-6">
              <p className="text-section text-fg">Registration timeline</p>
              <p className="text-caption mt-0.5">
                We handle every filing — you&apos;ll only hear from us when something needs you
                personally.
              </p>
              {timeline.note && (
                <div className="mt-4 flex items-center gap-2.5 rounded-[var(--radius)] border border-hairline bg-bg-2/60 p-3.5">
                  <Hourglass className="size-4 shrink-0 text-fg-faint" />
                  <p className="text-[0.85rem] text-fg-muted">{timeline.note}</p>
                </div>
              )}
              <div className="mt-6">
                <Timeline items={timeline.items} />
              </div>
            </section>

            {/* documents vault */}
            <section className="card p-6">
              <p className="text-section text-fg">Your document vault</p>
              <p className="text-caption mt-0.5">
                Everything we prepare or receive for you, investor-ready from day one.
              </p>
              {docs.length === 0 ? (
                <div className="mt-4 grid place-items-center rounded-[var(--radius)] border border-dashed border-hairline-2 bg-bg-2/40 px-6 py-10 text-center">
                  <FileText className="size-5 text-fg-faint" />
                  <p className="mt-3 max-w-sm text-[0.85rem] leading-relaxed text-fg-muted">
                    Documents appear here as we prepare them — your constitution first, then
                    certificates as the government issues them.
                  </p>
                </div>
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {docs.map((doc) => {
                    const Icon = DOC_ICONS[doc.kind] ?? FileText;
                    const tally = docSigs.get(doc.id);
                    const isSigned = tally && tally.total > 0 && tally.signed === tally.total;
                    return (
                      <div
                        key={doc.id}
                        className="flex flex-col rounded-[var(--radius)] border border-hairline bg-bg-2/40 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-tz-500/12 text-tz-300">
                            <Icon className="size-4" />
                          </span>
                          {isSigned && (
                            <Badge tone="success" className="shrink-0">
                              Signed ✓
                            </Badge>
                          )}
                        </div>
                        <p className="mt-3 text-[0.875rem] font-medium leading-snug text-fg">
                          {doc.title}
                        </p>
                        <p className="text-caption mt-1">
                          {kindLabel(doc.kind)} · <span className="tnum">{formatKb(doc.sizeBytes)}</span>
                        </p>
                        <a
                          href={`/api/artifacts/${doc.storageKey}`}
                          className="mt-3 inline-flex items-center gap-1.5 text-[0.8rem] font-medium text-tz-300 transition-colors hover:text-tz-400"
                        >
                          <Download className="size-3.5" /> Download
                        </a>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* ------------------------------ right rail --------------------- */}
          <aside className="min-w-0 space-y-6 lg:sticky lg:top-[84px]">
            {/* compliance preview */}
            <section className="card p-5">
              <p className="text-section text-fg">Your compliance calendar</p>
              <p className="text-caption mt-0.5">
                Goes live the day you&apos;re registered — so nothing is ever late.
              </p>
              <ul className="mt-4 divide-y divide-hairline">
                {shownRules.map((rule) => (
                  <li
                    key={rule.type}
                    className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[0.82rem] font-medium text-fg">{rule.title}</p>
                      <p className="text-caption tnum mt-0.5">
                        {rule.due
                          ? `Next due ${formatDayMonth(rule.due)}`
                          : rule.cadence === "event"
                            ? "Within 30 days of a change"
                            : "Scheduled once it's issued"}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-hairline bg-panel-2 px-2 py-0.5 text-[0.68rem] font-medium capitalize text-fg-muted">
                      {rule.cadence === "event" ? "on change" : rule.cadence}
                    </span>
                  </li>
                ))}
              </ul>
              {moreRules > 0 && (
                <p className="text-caption mt-3 border-t border-hairline pt-3">
                  +{moreRules} more once you&apos;re up and running
                </p>
              )}
            </section>

            {/* fees */}
            <section className="card p-5">
              <p className="text-section text-fg">Government fees</p>
              {pays.length > 0 ? (
                <>
                  <p className="text-caption mt-0.5">Every shilling, receipted in your vault.</p>
                  <table className="mt-3 w-full text-[0.82rem]">
                    <tbody>
                      {pays.map((p) => (
                        <tr key={p.id}>
                          <td className="py-1.5 pr-2 text-fg-muted">
                            {p.description || p.payee}
                            <span className="block text-[0.7rem] text-fg-faint">{p.payee}</span>
                          </td>
                          <td className="tnum py-1.5 text-right align-top text-fg">
                            {formatTzs(p.amountTzs)}
                          </td>
                          <td className="py-1.5 pl-2 text-right align-top">
                            <Badge
                              tone={
                                p.status === "paid" || p.status === "verified"
                                  ? "success"
                                  : p.status === "expired"
                                    ? "danger"
                                    : "neutral"
                              }
                            >
                              {p.status === "paid" || p.status === "verified"
                                ? "Paid"
                                : p.status === "expired"
                                  ? "Expired"
                                  : "Issued"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : (
                <>
                  <p className="text-caption mt-0.5">
                    Paid as you go, from your phone — we prompt you at each step.
                  </p>
                  <table className="mt-3 w-full text-[0.82rem]">
                    <tbody>
                      {FEE_ESTIMATE.map((f) => (
                        <tr key={f.label}>
                          <td className="py-1.5 text-fg-muted">{f.label}</td>
                          <td className="py-1.5 pl-2 text-right text-[0.72rem] text-fg-faint">
                            {f.authority}
                          </td>
                          <td className="tnum w-24 py-1.5 text-right text-fg">
                            {formatTzs(f.amount)}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t border-hairline">
                        <td className="pt-2 font-semibold text-fg">Total</td>
                        <td />
                        <td className="tnum pt-2 text-right font-semibold text-fg">
                          ~{formatTzs(feeTotal)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="text-caption mt-2.5">
                    TIN, NSSF, WCF and OSHA registrations are free. Our service fee is billed
                    separately.
                  </p>
                </>
              )}
            </section>

            {/* help */}
            <section className="card p-5">
              <p className="text-section text-fg">Questions? We reply within a business day.</p>
              <p className="text-caption mt-1">
                Anything about your registration, fees or timelines — just ask.
              </p>
              <a
                href="mailto:hello@tzcompliance.dev"
                className="mt-3 inline-flex items-center gap-1.5 text-[0.82rem] font-medium text-tz-300 transition-colors hover:text-tz-400"
              >
                <Mail className="size-3.5" /> Email us
              </a>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
